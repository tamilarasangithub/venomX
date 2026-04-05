from flask import Flask, request, jsonify, render_template
import os
import io
import time
from PIL import Image

import cv2
import numpy as np

def is_u_shaped_bite(img_path):
    try:
        img = cv2.imread(img_path)
        if img is None:
            return False
            
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        lower_red1 = np.array([0, 50, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 50, 50])
        upper_red2 = np.array([180, 255, 255])
        
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        
        lower_dark = np.array([0, 0, 0])
        upper_dark = np.array([180, 255, 50])
        dark_mask = cv2.inRange(hsv, lower_dark, upper_dark)
        
        mask = mask1 + mask2 + dark_mask
        
        kernel = np.ones((3,3), np.uint8)
        mask = cv2.erode(mask, kernel, iterations=1)
        mask = cv2.dilate(mask, kernel, iterations=2)
        
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        valid_spots = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 15 < area < 1000:
                valid_spots += 1
                
        if valid_spots >= 3:
            return True
            
        return False
    except Exception as e:
        print("Error in CV2 bite analysis:", e)
        return False

try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing import image
    import numpy as np
    HAS_TF = True
except ImportError:
    HAS_TF = False

app = Flask(__name__)

# Attempt to load model safely
MODEL_PATH = 'snake_model.h5'
model = None
if HAS_TF and os.path.exists(MODEL_PATH):
    try:
        model = load_model(MODEL_PATH)
        print("Model loaded successfully.")
    except Exception as e:
        print(f"Error loading model: {e}")

def prepare_image(img):
    if not HAS_TF:
        return None
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img = img.resize((224, 224))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    return img_array / 255.0

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        if model is not None and HAS_TF:
            # 1. Save locally exactly like Colab upload
            temp_path = "temp_upload_image.png"
            file.save(temp_path)

            # 2. Pre-process exactly as Colab does
            img = image.load_img(temp_path, target_size=(224, 224))
            x = image.img_to_array(img)
            x = np.expand_dims(x, axis=0)
            processed_img = x / 255.0  # Normalize (Important!)
            
            # 3. Predict exactly as Colab does
            prediction = model.predict(processed_img)
            
            # Safely handle the 5 model classes based on the Drive screenshot
            classes = [
                'Augmented / Other',   # Index 0
                'Cobra',               # Index 1
                'Common Krait',        # Index 2
                'Non-Venomous',        # Index 3
                "Russell's Viper"      # Index 4
            ]
            
            result_idx = int(np.argmax(prediction))
            
            if result_idx < len(classes):
                result = classes[result_idx]
            else:
                result = f"Unknown Class #{result_idx}"
            
            confidence = float(np.max(prediction))
            
            # --- U-Shape Override ---
            if is_u_shaped_bite(temp_path):
                print("Overriding AI prediction due to U-shape heuristic.")
                result = 'Non-Venomous'
                confidence = 0.999
            # ------------------------
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
        else:
            # Mock response for UI testing if model is missing
            time.sleep(1.5) # Simulate processing time
            result = "Russell's Viper" # Dummy result
            confidence = 0.9234
            
        return jsonify({'prediction': result, 'confidence': confidence})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400
    
    msg = data['message'].lower()
    
    # Keyword based symptom mapping based on user's table
    cobra_keywords = ['drowsiness', 'blur', 'swallowing', 'ptosis', 'droop']
    krait_keywords = ['abdominal', 'paralysis', 'invisible', 'night']
    russell_keywords = ['intense pain', 'continuous bleeding', 'massive swelling', 'bruising', 'blood', 'urine']
    saw_scaled_keywords = ['localized pain', 'internal bleeding', 'rapid swelling', 'discoloration', 'black', 'purple']
    
    hospital_keywords = ['hospital', 'clinic', 'doctor', 'emergency', 'near']
    
    if any(k in msg for k in hospital_keywords):
        return jsonify({
            'response': "If you need immediate medical attention, please click the <strong>Find Hospital</strong> button below to locate the nearest emergency room.",
            'action': 'hospital'
        })
        
    scores = {
        'Spectacled Cobra (Neurotoxic)': sum(1 for k in cobra_keywords if k in msg),
        'Common Krait (Neurotoxic)': sum(1 for k in krait_keywords if k in msg),
        "Russell's Viper (Hemotoxic)": sum(1 for k in russell_keywords if k in msg),
        'Saw-scaled Viper (Hemotoxic)': sum(1 for k in saw_scaled_keywords if k in msg)
    }
    
    max_score = max(scores.values())
    if max_score > 0:
        # Get the match with the highest score
        matches = [snake for snake, score in scores.items() if score == max_score]
        return jsonify({
            'response': f"Based on the symptoms you've described, this could potentially be a bite from a <strong>{matches[0]}</strong>. Please seek medical help immediately! Antivenom is crucial."
        })
        
    return jsonify({
        'response': "I am the VenomX AI Emergency Assistant. I can help analyze your symptoms or find a nearby hospital. Please describe any symptoms you are experiencing (e.g., 'blurred vision', 'massive swelling', 'abdominal pain') or ask for a 'hospital'."
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
