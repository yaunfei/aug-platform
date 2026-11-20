"""ORM 模型：form_schema / form_record / chat_session / view_config。"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# SQLite（测试）与 PostgreSQL（生产）双适配
BigIntPK = BigInteger().with_variant(Integer, "sqlite")
JsonType = JSON().with_variant(JSONB, "postgresql")


class Base(DeclarativeBase):
    pass


class FormSchemaModel(Base):
    __tablename__ = "form_schema"
    __table_args__ = (
        UniqueConstraint("form_key", "version", name="uq_form_schema_key_version"),
        Index("idx_form_schema_key", "form_key"),
    )

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    form_key: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_json: Mapped[dict] = mapped_column(JsonType, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="published")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FormRecordModel(Base):
    __tablename__ = "form_record"
    __table_args__ = (
        Index("idx_form_record_key_created", "form_key", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    form_key: Mapped[str] = mapped_column(String(64), nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[dict] = mapped_column(JsonType, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ChatSessionModel(Base):
    __tablename__ = "chat_session"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    session_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    messages: Mapped[list] = mapped_column(JsonType, nullable=False, default=list)
    schema_json: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ViewConfigModel(Base):
    __tablename__ = "view_config"
    __table_args__ = (
        UniqueConstraint("view_key", "version", name="uq_view_config_key_version"),
        Index("idx_view_config_key", "view_key"),
    )

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    view_key: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    form_key: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    mapping_json: Mapped[dict] = mapped_column(JsonType, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="published")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
