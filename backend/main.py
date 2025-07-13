import asyncio
import json
import random
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Set

from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from starlette.responses import StreamingResponse

# VibeCoding Logger (assuming it's installed or in the path)
# If vibelogger is not a real package, we'll simulate it.
try:
    from vibelogger import create_file_logger, create_logger, VibeLoggerConfig
    _vibelogger_installed = True
except ImportError:
    _vibelogger_installed = False
    # Simple mock for VibeCoding Logger if not available
    class MockLogger:
        def __init__(self, name, log_dir=None):
            self.name = name
            if log_dir:
                self.log_file = Path(log_dir) / f"{name}.log"
                print(f"MockLogger initialized. Logs will be written to: {self.log_file}")
            else:
                self.log_file = None
                print(f"MockLogger initialized for '{name}' (console only)")
            
        def _log(self, level, operation=None, message=None, context=None, **kwargs):
            import datetime
            log_entry = {
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "level": level,
                "operation": operation,
                "message": message,
                "context": context or {},
                **kwargs
            }
            
            # ログファイルに追記（ファイルパスが設定されている場合のみ）
            if self.log_file:
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(json.dumps(log_entry) + "\n")
            
            # コンソールにも出力
            print(json.dumps(log_entry))
            return log_entry
            
        def info(self, operation=None, message=None, context=None, human_note=None, **kwargs):
            return self._log("INFO", operation=operation, message=message, context=context, human_note=human_note, **kwargs)
            
        def warning(self, operation=None, message=None, context=None, human_note=None, **kwargs):
            return self._log("WARNING", operation=operation, message=message, context=context, human_note=human_note, **kwargs)
            
        def error(self, operation=None, message=None, context=None, human_note=None, **kwargs):
            return self._log("ERROR", operation=operation, message=message, context=context, human_note=human_note, **kwargs)
            
        def debug(self, operation=None, message=None, context=None, human_note=None, **kwargs):
            return self._log("DEBUG", operation=operation, message=message, context=context, human_note=human_note, **kwargs)
            
        def success(self, operation=None, message=None, context=None, human_note=None, **kwargs):
            return self._log("SUCCESS", operation=operation, message=message, context=context, human_note=human_note, **kwargs)

    def create_file_logger(name):
        # 実際のvibeloggerに合わせて、log_dir引数は削除
        # ログディレクトリは自動的にLOG_DIRに設定
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        print(f"Log directory set to: {LOG_DIR}")
        return MockLogger(name, str(LOG_DIR))

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

# ダミーログ生成の制御フラグ
ENABLE_DUMMY_LOGS = True

# --- Helper Functions ---
def serialize_log_entry(log_entry):
    """LogEntryオブジェクトを辞書に変換する"""
    if log_entry is None:
        return None
        
    # log_entryがすでに辞書の場合はそのまま返す
    if isinstance(log_entry, dict):
        return log_entry
        
    # LogEntryオブジェクトの場合
    try:
        # __dict__を使って基本的な変換
        log_dict = {}
        for key, value in log_entry.__dict__.items():
            if value is None:
                log_dict[key] = None
            elif hasattr(value, '__dict__'):
                # ネストされたオブジェクト（EnvironmentInfoなど）も変換
                log_dict[key] = value.__dict__
            else:
                log_dict[key] = value
        return log_dict
    except Exception as e:
        print(f"serialize_log_entry エラー: {e}")
        # フォールバック：str()で変換
        return {"raw_log": str(log_entry), "error": f"Serialization failed: {e}"}

# --- Logger Setup ---
from datetime import datetime
import random

# ロガーインスタンスを管理する辞書
loggers = {}

def get_operation_logger(project_name: str, operation_name: str):
    """プロジェクト名とオペレーション名に基づいてロガーを取得または作成する"""
    logger_key = f"{project_name}_{operation_name}"
    if logger_key not in loggers:
        project_log_dir = LOG_DIR / project_name
        project_log_dir.mkdir(exist_ok=True)
        
        # タイムスタンプをファイル名に入れることで、起動ごとに新しいログファイルが作られる
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        log_filename = f"{operation_name}_{timestamp}_{random.randint(100,999)}.log"
        
        # VibeLoggerConfig が見つからない場合はモックを使用する
        try:
            from vibelogger import VibeLoggerConfig, create_logger
        except ImportError:
            # モックの場合、VibeLoggerConfig は存在しない可能性があるため、ここでは何もしない
            pass

        config = VibeLoggerConfig(
            log_file=project_log_dir / log_filename,
            max_file_size_mb=5, # デモ用に小さく設定
            auto_save=True,
            keep_logs_in_memory=False, # サーバーサイドではメモリに保持する必要は基本的にない
            max_memory_logs=1
        )
        loggers[logger_key] = create_logger(config=config)
        print(f"***** Logger created for '{logger_key}' at '{project_log_dir / log_filename}' *****")

    return loggers[logger_key]

# -------------------------------------------------------------------
# テスト用のログ生成関数（Colabで動作していた機能）
# -------------------------------------------------------------------
async def generate_logs_for_test(num_logs: int = 10):
    """指定された回数だけログを生成し、コンソールに出力します。"""
    print(f"\n--- Generating {num_logs} log entries ---")
    
    operations = ["user_login", "db_query", "file_upload", "api_call", "data_processing"]
    users = ["Alice", "Bob", "Charlie", "David"]
    
    for i in range(num_logs):
        # ログ生成の間隔をランダムに設定
        await asyncio.sleep(random.uniform(0.2, 1.0))
        
        log_level = random.choices(["INFO", "WARNING", "ERROR", "SUCCESS", "DEBUG"], weights=[5, 2, 1, 3, 2], k=1)[0]
        operation = random.choice(operations)
        user = random.choice(users)
        
        print(f"\n[Log {i+1}/{num_logs}]")
        print(f"log_level = {log_level}")
        
        if log_level == "INFO":
            log_entry = vibe_logger.info(
                operation=operation,
                message=f"{operation} started",
                context={"user": user, "status": "started"},
                human_note=f"AI: Monitor {operation} completion for user {user}"
            )
            print(log_entry)
        elif log_level == "WARNING":
            log_entry = vibe_logger.warning(
                operation=operation,
                message=f"High latency detected in {operation}",
                context={"user": user, "latency_ms": random.randint(500, 1000)},
                human_note=f"AI: Investigate performance bottlenecks in {operation} - consider caching or optimization"
            )
        elif log_level == "ERROR":
            log_entry = vibe_logger.error(
                operation=operation,
                message=f"Failed to complete {operation}",
                context={"user": user, "error_code": random.randint(500, 504)},
                human_note=f"AI: Analyze {operation} failure patterns and suggest error handling improvements"
            )
        elif log_level == "SUCCESS":
            log_entry = vibe_logger.info(
                operation=operation,
                message=f"{operation} completed successfully",
                context={"user": user, "duration_ms": random.randint(100, 400)},
                human_note=f"AI: Track {operation} performance metrics and identify optimization opportunities"
            )
        elif log_level == "DEBUG":
            log_entry = vibe_logger.debug(
                operation=operation,
                message=f"Debugging {operation}",
                context={"user": user, "details": {"step": random.randint(1, 5)}},
                human_note=f"AI: Trace execution flow for {operation} to identify potential issues"
            )

async def test_logger():
    """テストを実行するためのメイン非同期関数"""
    print("Base directory set to:", BASE_DIR)
    print("Log directory set to:", LOG_DIR)
    
    # 生成したいログの数を指定してテスト関数を呼び出す
    await generate_logs_for_test(num_logs=5)
    print("\n--- Log generation test finished. ---")
    print(f"All generated logs are saved in: {LOG_DIR}")

# --- Connection Management ---
class ConnectionManager:
    def __init__(self):
        self.active_websockets: Set[WebSocket] = set()
        self.active_sse_queues: Set[asyncio.Queue] = set()

    async def connect_ws(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.add(websocket)

    def disconnect_ws(self, websocket: WebSocket):
        self.active_websockets.remove(websocket)

    async def connect_sse(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.active_sse_queues.add(queue)
        return queue
    
    def disconnect_sse(self, queue: asyncio.Queue):
        self.active_sse_queues.remove(queue)

    async def broadcast(self, message: str):
        # Broadcast to WebSockets
        for websocket in self.active_websockets:
            try:
                await websocket.send_text(message)
            except WebSocketDisconnect:
                # This will be handled by the endpoint's finally block
                pass
            except Exception:
                # Handle other potential errors
                pass

        # Broadcast to SSE queues
        for queue in self.active_sse_queues:
            await queue.put(message)

manager = ConnectionManager()

# --- Background Log Generation ---
async def generate_logs():
    """Periodically generates and broadcasts logs."""
    import uuid
    projects = [
        {"name": "api_backend", "operations": ["user_login", "db_query", "api_call"]},
        {"name": "web_app_frontend", "operations": ["user_interaction", "rendering"]},
        {"name": "data_etl_pipeline", "operations": ["file_upload", "data_processing"]},
        {"name": "ai_ml_training", "operations": ["training_step", "evaluation"]},
        {"name": "monitoring_alerts", "operations": ["health_check", "alert_trigger"]},
    ]
    users = ["Alice", "Bob", "Charlie", "David"]
    
    print("********* generate_logs()関数が開始されました ")
    
    while True:
        try:
            await asyncio.sleep(random.uniform(1, 3))
            
            project = random.choice(projects)
            project_name = project["name"]
            operation = random.choice(project["operations"])
            user = random.choice(users)
            log_level = random.choices(["INFO", "WARNING", "ERROR", "SUCCESS", "DEBUG"], weights=[5, 2, 1, 3, 2], k=1)[0]
            
            log_id = str(uuid.uuid4()).split('-')[0]
            
            # オペレーションに応じたロガーを取得
            vibe_logger = get_operation_logger(project_name, operation)
            
            print(f"ログ生成中: {project_name} - {log_level} - {operation} - {user}")
            
            log_entry = {}
            base_context = {"user": user, "project": project_name, "log_id": log_id}
            message = f"{operation} status"

            if log_level == "INFO":
                log_entry = vibe_logger.info(
                    operation=operation,
                    message=f"{operation} started",
                    context={**base_context, "status": "started"},
                    human_note=f"AI: Monitor {operation} completion for user {user}"
                )
            elif log_level == "WARNING":
                log_entry = vibe_logger.warning(
                    operation=operation,
                    message=f"High latency detected in {operation}",
                    context={**base_context, "latency_ms": random.randint(500, 1000)},
                    human_note=f"AI: Investigate performance bottlenecks in {operation}"
                )
            elif log_level == "ERROR":
                log_entry = vibe_logger.error(
                    operation=operation,
                    message=f"Failed to complete {operation}",
                    context={**base_context, "error_code": random.randint(500, 504)},
                    human_note=f"AI: Analyze {operation} failure patterns"
                )
            elif log_level == "SUCCESS":
                 log_entry = vibe_logger.info( # Assuming .success is not available
                    operation=operation,
                    message=f"{operation} completed successfully",
                    context={**base_context, "duration_ms": random.randint(100, 400)},
                    human_note=f"AI: Track {operation} performance metrics"
                )
            elif log_level == "DEBUG":
                log_entry = vibe_logger.debug(
                    operation=operation,
                    message=f"Debugging {operation}",
                    context={**base_context, "details": {"step": random.randint(1, 5)}},
                    human_note=f"AI: Trace execution flow for {operation}"
                )
            
            print(f"ログエントリが生成されました: {type(log_entry)}")
            
            # log_entryをJSON化してブロードキャスト
            try:
                if log_entry:
                    # LogEntryオブジェクトを辞書に変換
                    log_dict = serialize_log_entry(log_entry)
                        
                    message_json = json.dumps(log_dict, default=str, ensure_ascii=False)
                    print(f"ブロードキャスト中: {message_json[:100]}...")
                    await manager.broadcast(message_json)
                    print("***** ブロードキャスト完了 *****")
                else:
                    print("警告: log_entryが空です")
            except Exception as broadcast_error:
                print(f"ブロードキャストエラー: {broadcast_error}")
                # 単純なメッセージをブロードキャスト
                fallback_message = {
                    "level": log_level,
                    "operation": operation,
                    "message": f"{operation} {log_level}",
                    "user": user,
                    "timestamp": datetime.now().isoformat()
                }
                await manager.broadcast(json.dumps(fallback_message))
                
        except Exception as e:
            print(f"generate_logs()でエラーが発生しました: {e}")
            print(f"エラーの詳細: {type(e).__name__}: {str(e)}")
            # エラーが発生してもwhileを継続
            await asyncio.sleep(1)  # エラー後は短い間隔で再試行

# --- FastAPI App Lifecycle ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Log vibelogger status only once
    if _vibelogger_installed:
        print("********* 実際の 'vibelogger' パッケージが見つかりました。使用します。")
    else:
        print("'********* vibelogger' パッケージが見つかりませんでした。モックロガーを使用します。")

    # Start the background task
    log_task = None
    if ENABLE_DUMMY_LOGS:
        log_task = asyncio.create_task(generate_logs())
    else:
        print("Dummy log generation is disabled. Skipping background task.")
    yield
    # Clean up the task
    if log_task:
        log_task.cancel()
        try:
            await log_task
        except asyncio.CancelledError:
            print("Log generation task cancelled.")

app = FastAPI(lifespan=lifespan)

# --- API Endpoints ---
PROJECT_DESCRIPTIONS = {
    "api_backend": "FastAPI backend service logs",
    "web_app_frontend": "React-based UI",
    "data_etl_pipeline": "Airflow DAGs",
    "ai_ml_training": "PyTorch training jobs",
    "monitoring_alerts": "Prometheus/Grafana alerts",
    "default": "General application logs"
}

@app.get("/api/projects")
async def get_projects():
    projects_data = []
    if not LOG_DIR.exists():
        return []
        
    for project_dir in LOG_DIR.iterdir():
        if project_dir.is_dir():
            files = [f.name for f in project_dir.glob("*.log")]
            if files: # ファイルがあるプロジェクトのみ追加
                projects_data.append({
                    "name": project_dir.name,
                    "description": PROJECT_DESCRIPTIONS.get(project_dir.name, PROJECT_DESCRIPTIONS["default"]),
                    "files": files
                })
    return sorted(projects_data, key=lambda x: x['name'])


@app.get("/", response_class=HTMLResponse)
async def get_root():
    return await asyncio.to_thread(Path(FRONTEND_DIR / "index.html").read_text, encoding="utf-8")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect_ws(websocket)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    finally:
        manager.disconnect_ws(websocket)

@app.get("/sse")
async def sse_endpoint(request: Request):
    queue = await manager.connect_sse()
    print("\033[92mINFO:\033[0m     SSE connection open")  # WebSocket接続を受け付けた際は自動的にログが出力されるようなので SSE の方にだけ print する

    async def event_generator():
        try:
            while True:
                # Check if client is still connected
                if await request.is_disconnected():
                    break
                message = await queue.get()
                yield f"data: {message}\n\n"
        except asyncio.CancelledError:
            print("SSE client disconnected")
        finally:
            manager.disconnect_sse(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# --- External Log Ingestion Endpoint ---
from pydantic import BaseModel


class IncomingLog(BaseModel):
    timestamp: str | None = None
    level: str = "INFO"
    operation: str = ""
    message: str = ""
    context: dict | None = None
    project: str = "external_project"


@app.post("/api/ingest")
async def ingest_log(log: IncomingLog):
    """外部サービスから送信されたログを保存し、リアルタイム配信する"""
    from datetime import datetime, timezone

    timestamp = log.timestamp or datetime.now(timezone.utc).isoformat()

    vibe_logger = get_operation_logger(log.project, log.operation or "external")
    level_method = getattr(vibe_logger, log.level.lower(), vibe_logger.info)
    log_entry = level_method(
        operation=log.operation or "external",
        message=log.message,
        context=log.context,
        human_note="Received via /api/ingest",
    )

    log_dict = serialize_log_entry(log_entry) or {}
    log_dict.setdefault("timestamp", timestamp)
    log_dict.setdefault("project", log.project)

    await manager.broadcast(json.dumps(log_dict, ensure_ascii=False))

    return {"status": "ok"}

# --- Static Files (registered after all API routes) ---
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")

if __name__ == "__main__":
    import sys
    import argparse
    
    # コマンドライン引数の解析
    parser = argparse.ArgumentParser(description="VibeCoding Logger Server")
    parser.add_argument("mode", nargs="?", default="server", choices=["test", "server"], 
                       help="Run mode: 'test' for log generation test, 'server' for FastAPI server")
    parser.add_argument("--no-dummy", action="store_true", 
                       help="Disable dummy log generation in server mode")
    parser.add_argument("--port", type=int, default=6702, help="Port to run the server on")
    args = parser.parse_args()
    
    # ダミーログ生成フラグの設定
    if args.no_dummy:
        ENABLE_DUMMY_LOGS = False
        print("Dummy log generation is disabled.")
    
    if args.mode == "test":
        # テストモード：Colabのようにログを生成してテスト
        print("Running in test mode...")
        asyncio.run(test_logger())
    else:
        # サーバーモード：FastAPIアプリとして起動
        print("Running in server mode...")
        
        import uvicorn

        # reload=True の場合はインポート文字列を渡し、
        # reload=False の場合は app オブジェクトを直接渡すことで、
        # --no-dummy フラグの状態を維持する
        if ENABLE_DUMMY_LOGS:
            print("Dummy log generation is enabled. Starting with auto-reload.")
            uvicorn.run(
                "main:app",  # For reload, must use string
                host="127.0.0.1",
                port=args.port,
                reload=True
            )
        else:
            uvicorn.run(
                app,  # For no-reload, pass app object to preserve flag state
                host="127.0.0.1",
                port=args.port,
                reload=False
            )