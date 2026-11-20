-- AI 驱动 Schema 表单平台：数据库初始化
-- 用法：psql -U postgres -f scripts/init_db.sql
-- 之后执行：cd server && uv run alembic upgrade head

CREATE DATABASE aug_platform;
\connect aug_platform

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 表结构由 Alembic 管理：
--   0001 form_schema / form_record
--   0002 chat_session
--   0003 view_config
--   0004 pg_trgm GIN 表达式索引
