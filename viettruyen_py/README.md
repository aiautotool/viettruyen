# VietTruyen Python Clone

## Yêu cầu
- Python 3.8+
- pip

## Cài đặt
```bash
python3 -m venv viettruyen_py_env
source viettruyen_py_env/bin/activate
pip install -r requirements.txt
```

## Chạy server
```bash
cd app
uvicorn main:app --reload
```

Truy cập: http://localhost:8000

## Cấu trúc thư mục
- `app/main.py`: Khởi tạo FastAPI, cấu hình Jinja2
- `app/templates/`: Chứa các file HTML template
- `app/static/`: Chứa file tĩnh (ảnh, css, js, ...)
- `app/routes/`, `app/services/`, `app/models/`: Sẽ phát triển tiếp các chức năng API
