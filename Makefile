# Makefile helpers for models and E2E

.PHONY: models models-clean e2e e2e-down

models:
	bash tools/fetch_models.sh

models-clean:
	rm -rf yolo-detection/models/* reid-service/models/* face-service/models/* models/VERSIONS.txt || true

e2e:
	bash tools/e2e_smoke.sh

e2e-down:
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v || true
