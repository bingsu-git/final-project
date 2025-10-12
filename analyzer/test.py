import requests

try:
    res = requests.post(
        "http://localhost:5001/analyze",
        json={"text": "Did he went to school?"}
    )
    res.raise_for_status()  # 에러 발생 시 예외 처리
    print(res.json())
except Exception as e:
    print("에러 발생:", e)
