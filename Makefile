SHELL := /bin/bash
API_PORT ?= 8100
WEB_PORT ?= 8000

.PHONY: help install server-install web-install dev dev-server dev-web migrate revision \
	test test-server test-web tsc build eval bench init-db java-test java-build java-run consumer-run clean

help:
	@echo "make install        安装前后端依赖"
	@echo "make dev            同时启动后端(:$(API_PORT)) 与前端(:$(WEB_PORT))"
	@echo "make migrate        执行 Alembic 迁移"
	@echo "make test           后端 pytest + 前端 vitest + tsc"
	@echo "make build          构建前端产物"
	@echo "make eval           AI 生成/修改评测（mock 模式）"
	@echo "make bench          记录查询并发压测"
	@echo "make init-db        初始化 PostgreSQL 数据库与 pg_trgm 扩展"
	@echo "make java-test      Java Dubbo 服务单测（mvn test）"
	@echo "make java-build     打包 Provider / Consumer 可执行 jar"
	@echo "make java-run       启动 Dubbo Provider（:20880）"
	@echo "make consumer-run   启动 Consumer Demo（:8180）"

install: server-install web-install

server-install:
	cd server && uv sync

web-install:
	cd web && pnpm install

dev:
	@trap 'kill 0' EXIT; \
	(cd server && uv run uvicorn app.main:app --reload --port $(API_PORT)) & \
	(cd web && pnpm dev --port $(WEB_PORT)) & \
	wait

dev-server:
	cd server && uv run uvicorn app.main:app --reload --port $(API_PORT)

dev-web:
	cd web && pnpm dev --port $(WEB_PORT)

migrate:
	cd server && uv run alembic upgrade head

revision:
	cd server && uv run alembic revision --autogenerate -m "$(m)"

test: test-server test-web

test-server:
	cd server && uv run pytest -q

test-web:
	cd web && pnpm test && pnpm tsc

tsc:
	cd web && pnpm tsc

build:
	cd web && pnpm build

eval:
	cd server && uv run python scripts/eval_schema.py

bench:
	cd server && uv run python scripts/bench_records.py

init-db:
	psql -h $${DB_HOST:-localhost} -U $${DB_USER:-postgres} -f scripts/init_db.sql

java-test:
	cd java-provider && mvn -B test

java-build:
	cd java-provider && mvn -B -DskipTests package

java-run: java-build
	java -jar java-provider/record-provider-app/target/record-provider-app-1.0.0.jar

consumer-run: java-build
	java -jar java-provider/record-consumer-demo/target/record-consumer-demo-1.0.0.jar

clean:
	rm -rf web/dist web/.umi server/.pytest_cache server/uploads java-provider/*/target
