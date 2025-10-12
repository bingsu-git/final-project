from flask import Flask, request, jsonify
import spacy

app = Flask(__name__)
nlp = spacy.load("en_core_web_sm")

def detect_patterns(text):
    doc = nlp(text)
    results = []

    # Double past 오류: Did + 과거형 동사
    has_did = any(tok.text.lower() == "did" and tok.tag_ == "VBD" for tok in doc)
    has_past_verb = any(tok.tag_ == "VBD" and tok.text.lower() != "did" for tok in doc)
    if has_did and has_past_verb:
        results.append({
            "pattern": "double-past",
            "explanation": "조동사 'did'와 과거형 동사가 함께 사용되었습니다."
        })

    # 주어-동사 불일치: He go
    for tok in doc:
        if tok.dep_ == "nsubj" and tok.head.tag_ == "VB":
            if tok.text.lower() in ["he", "she", "it"]:
                results.append({
                    "pattern": "subject-verb-agreement",
                    "explanation": "주어(3인칭 단수)와 동사 형태가 일치하지 않습니다."
                })

    return results

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    text = data.get("text", "")
    if not text:
        return jsonify({ "error": "No text provided" }), 400

    patterns = detect_patterns(text)
    return jsonify({
        "text": text,
        "patterns": patterns
    })

if __name__ == "__main__":
    app.run(port=5001)
