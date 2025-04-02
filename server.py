# backend/server.py
import os
import pickle
import tensorflow as tf
from tensorflow.keras.preprocessing.sequence import pad_sequences
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import logging

# --- Configuration ---
MODEL_DIR = 'saved_model'
MODEL_PATH = os.path.join(MODEL_DIR, 'full_model.h5')
TOKENIZER_PATH = os.path.join(MODEL_DIR, 'tokenizer.pkl')
PARAMS_PATH = os.path.join(MODEL_DIR, 'model_params.pkl')
EXPECTED_PICKLE_PROTOCOL = 4 # Match the protocol used in Colab save

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Load Model and Tokenizer ---
try:
    logger.info(f"Loading model parameters from: {PARAMS_PATH}")
    with open(PARAMS_PATH, 'rb') as f:
        params = pickle.load(f)
    MAX_WORDS = params['max_words']
    MAX_LEN = params['max_len']
    EMBED_DIM = params['embed_dim'] # Not strictly needed for prediction, but good practice
    logger.info(f"Model parameters loaded: max_words={MAX_WORDS}, max_len={MAX_LEN}")

    logger.info(f"Loading tokenizer from: {TOKENIZER_PATH}")
    with open(TOKENIZER_PATH, 'rb') as f:
        # Ensure compatibility if loading pickle from different Python version
        tokenizer = pickle.load(f)
    logger.info("Tokenizer loaded successfully.")

    logger.info(f"Loading Keras model from: {MODEL_PATH}")
    # Load the model without compiling if you only need prediction
    # If you face issues, try loading with compile=False
    model = tf.keras.models.load_model(MODEL_PATH, compile=True)
    # Perform a dummy prediction to ensure the model is ready (optional but good)
    dummy_input = np.zeros((1, MAX_LEN))
    _ = model.predict(dummy_input)
    logger.info("Keras model loaded and tested successfully.")

except FileNotFoundError as e:
    logger.error(f"Error loading model assets: {e}. Make sure '{MODEL_DIR}' exists and contains the required files.")
    exit() # Stop the server if essential files are missing
except Exception as e:
    logger.error(f"An unexpected error occurred during model loading: {e}")
    exit()

# --- Preprocessing Function (adapted from your class) ---
def preprocess_email_text(subject, body):
    """ Preprocesses combined subject and body text for the model. """
    text = f"[SUBJ] {subject if subject else ''} [BODY] {body if body else ''}"
    text = ' '.join(text.split()) # Remove extra whitespace
    text = text.lower() # Convert to lowercase
    text = re.sub(r'http\S+|www\S+|https\S+', '[URL]', text, flags=re.MULTILINE)
    text = re.sub(r'\S+@\S+', '[EMAIL]', text)
    text = re.sub(r'\d+', '[NUM]', text)
    return text

# --- Flask App ---
app = Flask(__name__)
CORS(app) # Allow requests from the extension (adjust origins in production)

@app.route('/')
def index():
    return "Phishing Detection API is running!"

@app.route('/analyze', methods=['POST'])
def analyze_email():
    logger.info("Received request for /analyze")
    try:
        data = request.get_json()
        if not data or 'subject' not in data or 'body' not in data:
            logger.warning("Invalid request data received.")
            return jsonify({"error": "Missing 'subject' or 'body' in JSON payload"}), 400

        subject = data.get('subject', '')
        body = data.get('body', '')

        # Preprocess the text
        processed_text = preprocess_email_text(subject, body)

        # Tokenize and pad
        sequence = tokenizer.texts_to_sequences([processed_text])
        padded_sequence = pad_sequences(sequence, maxlen=MAX_LEN, padding='post', truncating='post')

        # Predict
        logger.info("Making prediction...")
        prediction = model.predict(padded_sequence)
        probability = float(prediction[0][0])
        logger.info(f"Prediction completed. Raw score: {probability:.4f}")

        # Determine risk level (same logic as your class)
        if probability > 0.8:
            risk_level = 'Very High'
        elif probability > 0.6:
            risk_level = 'High'
        elif probability > 0.4:
            risk_level = 'Medium'
        elif probability > 0.2:
            risk_level = 'Low'
        else:
            risk_level = 'Very Low'

        result = {
            'is_phishing': bool(probability > 0.5),
            'confidence': probability * 100,
            'risk_level': risk_level,
            'raw_score': probability
        }
        logger.info(f"Sending result: {result}")
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error during analysis: {e}", exc_info=True) # Log traceback
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500

# --- Run Server ---
if __name__ == '__main__':
    logger.info("Starting Flask server...")
    # Use 0.0.0.0 to make it accessible on your network if needed,
    # but 127.0.0.1 (localhost) is safer for local extension use.
    app.run(host='127.0.0.1', port=5000, debug=False) # Turn debug=False for production/sharing
    # Note: Using debug=True can be helpful during development but consumes more resources and poses security risks.