"""
--< The Freshness Guard — Main Flask Application >--
--< A manual food waste reduction app >--
--< No AI. No predictions. 100% user-inputted data and hard-coded logic. >--
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from models import db
from routes import api


def create_app():
    """--< Application factory — creates and configures the Flask app >--"""
    app = Flask(__name__, static_folder='static', static_url_path='')

    # --< Configuration >--
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///freshness_guard.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.urandom(24).hex()

    # --< Initialize extensions >--
    CORS(app)
    db.init_app(app)

    # --< Register API blueprint >--
    app.register_blueprint(api)

    # --< Create database tables on first run >--
    with app.app_context():
        db.create_all()

    # --< Serve the frontend >--
    @app.route('/')
    def serve_frontend():
        return send_from_directory(app.static_folder, 'index.html')

    return app

# --< Instantiate the app globally for Wasmer WSGI/ASGI >--
wsgi_app = create_app()

try:
    from asgiref.wsgi import WsgiToAsgi
    # --< Expose ASGI app for Wasmer edge deployment >--
    app = WsgiToAsgi(wsgi_app)
except ImportError:
    # --< Fallback if asgiref is not installed locally >--
    app = wsgi_app

if __name__ == '__main__':
    # --< Run the development server locally using WSGI >--
    wsgi_app.run(debug=True, host='0.0.0.0', port=5000)
