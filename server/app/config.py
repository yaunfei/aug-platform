"""应用配置：pydantic-settings 读取根目录 .env。"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # 数据库
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = "123456"
    db_name: str = "aug_platform"
    database_url: str | None = None

    # 服务
    api_port: int = 8100

    # 请求体积
    max_body_bytes: int = 1048576
    upload_max_body_bytes: int = 6291456

    # 鉴权
    auth_enabled: bool = False
    auth_token: str = "change-me"

    # AI
    ai_provider: str = "mock"  # mock | openai
    ai_base_url: str = "https://api.openai.com/v1"
    ai_api_key: str = ""
    ai_model: str = "gpt-4o-mini"
    ai_timeout_seconds: float = 60
    ai_max_retry: int = 2
    ai_chat_deadline_seconds: float = 90
    ai_chat_max_tool_rounds: int = 3
    ai_chat_max_calls_per_round: int = 4
    ai_chat_tool_result_budget: int = 12000

    # Webhook
    webhook_enabled: bool = False
    webhook_url: str = ""

    # 日志
    log_level: str = "INFO"
    log_file: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def uploads_path(self) -> str:
        return str(ROOT_DIR / "uploads")


settings = Settings()
