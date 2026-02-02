from flask import Flask
from flask_cors import CORS
import os

from routes.simulation_routes import simulation_bp
from routes.uploads_routes import upload_bp
from routes.training_route import training_bp

def creat_app():
    app = Flask(__name__, template_folder="../templates")
    CORS(app)

    app.config['UPLOAD_FOLDER'] = os.path.abspath("uploads")
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    #registro das notas
    app.register_blueprint(simulation_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(training_bp)

    return app