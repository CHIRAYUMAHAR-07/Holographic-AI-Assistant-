import os
import sqlite3
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from dotenv import load_dotenv
import atexit
import sys

load_dotenv()

app = Flask(__name__)
CORS(app)

print(f"🔍 PROCESS ID: {os.getpid()} - Starting Edith AI Backend")
print(f"📁 Working directory: {os.getcwd()}")

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BACKEND_DIR, "chatbot.db")

print(f"💾 Database path: {DB_PATH}")

ANAM_API_KEY = os.getenv('ANAM_API_KEY', "your_key")
AVATAR_ID = "30fa96d0-26c4-4e55-94a0-517025942e18"
VOICE_ID = "6bfbe25a-979d-40f3-a92b-5394170af54b"
LLM_ID = "0934d97d-0c3a-4f33-91b0-5e136a0ef466"

GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are Edith..."""

_db_connection = None

def get_db():
    global _db_connection
    if _db_connection is None:
        _db_connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        _db_connection.row_factory = sqlite3.Row
        print("🔌 Database connection created")
    return _db_connection

def close_db():
    global _db_connection
    if _db_connection:
        _db_connection.close()
        print("💾 Database connection closed")

atexit.register(close_db)

def init_database():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    print("✅ Database initialized")

# ── SESSION ROUTES ──
@app.route('/api/sessions', methods=['POST'])
def create_session():
    try:
        data = request.json
        name = data.get('name', f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, created_at FROM sessions
            WHERE name = ?
            ORDER BY created_at DESC
            LIMIT 1
        ''', (name,))

        existing = cursor.fetchone()

        if existing:
            last_time = datetime.fromisoformat(existing['created_at'])
            now = datetime.now()

            if abs((now - last_time).total_seconds()) < 2:
                print("⚠️ Duplicate session prevented")
                return jsonify({
                    "id": existing['id'],
                    "name": name,
                    "created_at": existing['created_at']
                })

        created_at = datetime.now().isoformat()

        cursor.execute(
            "INSERT INTO sessions (name, created_at) VALUES (?, ?)",
            (name, created_at)
        )

        session_id = cursor.lastrowid
        conn.commit()

        print(f"✅ Created session: {session_id}")

        return jsonify({
            "id": session_id,
            "name": name,
            "created_at": created_at
        })

    except Exception as e:
        print(f"Error creating session: {e}")
        return jsonify({"error": "Failed"}), 500

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC")
    return jsonify([dict(row) for row in cursor.fetchall()])

# ✅ FIXED: Added missing route decorator for DELETE
@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Delete messages first (foreign key constraint)
        cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        # Delete session
        cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
        
        print(f"✅ Deleted session: {session_id}")
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"Error deleting session: {e}")
        return jsonify({"error": "Failed to delete session"}), 500

# ── MESSAGE ROUTES ──
@app.route('/api/sessions/<int:session_id>/messages', methods=['GET'])
def get_messages(session_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,)
    )
    return jsonify([dict(row) for row in cursor.fetchall()])

@app.route('/api/sessions/<int:session_id>/messages', methods=['POST'])
def add_message(session_id):
    try:
        data = request.json
        role = data.get('role')
        content = data.get('content')
        created_at = datetime.now().isoformat()

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, created_at)
        )

        message_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            "id": message_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": created_at
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Failed"}), 500

# ── OTHER ROUTES ──
@app.route('/api/session-token', methods=['POST'])
def get_session_token():
    try:
        response = requests.post(
            "https://api.anam.ai/v1/auth/session-token",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {ANAM_API_KEY}"
            },
            json={
                "personaConfig": {
                    "avatarId": AVATAR_ID,
                    "voiceId": VOICE_ID,
                    "llmId": LLM_ID,
                    "systemPrompt": SYSTEM_PROMPT
                }
            },
            timeout=30
        )
        
        data = response.json()
        
        if response.status_code != 200:
            return jsonify({"error": data}), response.status_code
        
        return jsonify({"sessionToken": data.get("sessionToken")})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/groq', methods=['POST'])
def groq_chat():
    try:
        data = request.json
        message = data.get('message', '')
        chat_history = data.get('chatHistory', [])
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        if chat_history and len(chat_history) > 0:
            recent_history = chat_history[-10:]
            for msg in recent_history:
                messages.append({
                    "role": msg['role'] if msg['role'] != 'assistant' else 'assistant',
                    "content": msg['content']
                })
        
        messages.append({"role": "user", "content": message})
        
        groq_payload = {
            "messages": messages,
            "model": "llama-3.1-8b-instant",
            "temperature": 0.7,
            "max_tokens": 150,
        }
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            GROQ_API_URL,
            json=groq_payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"Groq API error: {response.text}")
            return jsonify({
                "reply": "I'm here to chat! What would you like to talk about? 🌟"
            })
        
        groq_response = response.json()
        reply = groq_response.get('choices', [{}])[0].get('message', {}).get('content', "I'm here to chat! What would you like to talk about? 🌟")
        
        return jsonify({"reply": reply})
    
    except Exception as e:
        print(f"Groq error: {e}")
        return jsonify({
            "error": str(e),
            "reply": "Oops! Something went wrong. Can you try again? 🌟"
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "database_path": DB_PATH,
        "database_exists": os.path.exists(DB_PATH),
        "process_id": os.getpid()
    })

# ── START SERVER ──
if __name__ == '__main__':
    init_database()

    port = int(os.getenv('PORT', 3000))

    print(f"\n{'='*50}")
    print(f"✅ Server running on http://localhost:{port}")
    print(f"💾 Database: {DB_PATH}")
    print(f"{'='*50}\n")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=False,
        use_reloader=False,
        threaded=False
    )