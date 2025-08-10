# Makefile helpers for models

.PHONY: models models-clean

models:
	bash tools/fetch_models.sh

models-clean:
	rm -rf yolo-detection/models/* reid-service/models/* face-service/models/* models/VERSIONS.txt || true
