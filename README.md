# file-translater
 Translate a files from Russia to languages with translate api.

## In English:
### For use
1. Open "bin" folder.
2. Open config.json
3. Change translate_url to your api url.
It should support the GET text parameter and return text with a translation in the object with the result.
4. Change languages, if necessary.
example, delete.
And change language of app (Supported: en, ru, zh, ko, es, ar).
5. Copy file for translate to lng directory.
6. Run binary file for your OS.
7. Send filename
8. Whait...
9. Click "Enter" for finish.

### For developing
Open src folder.
After the changes are completed, we send the command:
pkg . --debug
New binery files are created in dist folder.

## На Русском
### Для использования
1. Откройте папку "bin".
2. Откройте файл config.json
3. Измените translate_url на ваш URL-адрес api.
Он должен поддерживать GET параметр text и возвращать text с переводом в объект с результатом.
4. При необходимости измените языки, на которые надо переводить: languages.
например, удалить.
И измените язык приложения (поддерживается: en, ru, zh, ko, es, ar).
5. Скопируйте файл для перевода в каталог lng.
6. Запустите бинарный файл для вашей операционной системы.
7. Отправьте имя файла
8. Ждём...
9. Нажмите кнопку "Enter" для завершения.

### Для разработки
Откройте папку src.
После завершения изменений отправьте команду:
pkg . --debug
Новые файлы приложения создаются в папке dist.