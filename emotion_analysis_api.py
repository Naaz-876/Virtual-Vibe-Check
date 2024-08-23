from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import cv2
from deepface import DeepFace
from collections import Counter

app = Flask(__name__)
CORS(app)
@app.route('/analyze-emotions', methods=['POST'])
def analyze_emotions():
    # Define the path to the folder containing images
    images_folder = 'php/images/'

    # Initialize lists to store dominant emotions and percentages
    dominant_emotions = []
    dominant_emotion_percentages = []

    # Iterate over the images in the folder
    for filename in os.listdir(images_folder):
        if filename.endswith('.jpeg'):
            # Read the image
            img = cv2.imread(os.path.join(images_folder, filename))

            # Analyze emotions
            predictions = DeepFace.analyze(img)
            dominant_emotion = predictions[0]['dominant_emotion']
            dominant_emotion_percentage = predictions[0]['emotion'][dominant_emotion]

            # Store dominant emotion and percentage
            dominant_emotions.append(dominant_emotion)
            dominant_emotion_percentages.append(dominant_emotion_percentage)

    # Count the occurrences of each dominant emotion
    emotion_counts = Counter(dominant_emotions)

    # Find the most common dominant emotion and its count
    most_common_emotion, count_of_most_common_emotion = emotion_counts.most_common(1)[0]

    # Initialize a list to store percentages of the most common emotion
    percentages_for_most_common_emotion = []

    # Loop through each prediction and add percentage if dominant emotion matches most common emotion
    for i in range(len(dominant_emotions)):
        if dominant_emotions[i] == most_common_emotion:
            percentages_for_most_common_emotion.append(dominant_emotion_percentages[i])

    # Calculate the mean value only for the most common emotion
    mean_percentage_of_most_common_emotion = sum(percentages_for_most_common_emotion) / count_of_most_common_emotion

    # Construct the response JSON
    response_data = {
        "most_common_emotion": most_common_emotion,
        "count_of_most_common_emotion": count_of_most_common_emotion,
        "mean_percentage_of_most_common_emotion": mean_percentage_of_most_common_emotion
    }

    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True)
