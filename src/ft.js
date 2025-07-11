const fs = require('fs');
const path = require('path');
const rli = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});
const axios = require('axios');
const conf = JSON.parse(fs.readFileSync(`config.json`, "utf8"));
const lngs = conf.languages;
const lang = conf.app_language;

// Функция для ввода пользователя
function input(prompt) {
  return new Promise((resolve, reject) => {
    rli.question(prompt, (answer) => {
      resolve(answer);
    }, (error) => {
      reject(error);
    });
  });
}

// Функция для разбивки текста на предложения
function splitIntoSentences(text) {
  const sentenceEnders = /([.?!])\s+(?=[A-ZА-Я])/g;
  return text.split(sentenceEnders).reduce((acc, fragment, index, array) => {
    if (sentenceEnders.test(fragment)) {
      acc[acc.length - 1] += fragment;
    } else {
      acc.push(fragment);
    }
    return acc;
  }, []).filter(sentence => sentence.trim().length > 0);
}

// Функция для объединения предложений
function joinSentences(sentences) {
  return sentences.join(' ');
}

// Функция для перевода текста с разбиением на предложения
async function translate(lng, text) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (/^\d+$/.test(text)) {
    return text;
  }

  // Обработка заголовка, если присутствует
  const res_data = text.indexOf('# ') > -1 ? text.split('# ') : [];
  const textToTranslate = res_data.length > 1 ? res_data[1] : text;

  // Разбиваем текст на предложения
  const sentences = splitIntoSentences(textToTranslate);
  const translatedSentences = [];

  // Определяем максимальную длину URL (с запасом)
  const MAX_URL_LENGTH = 2000; // Вы можете изменить это значение при необходимости
  const baseUrl = conf.translate_url;
  const langParam = `ru-${lng}`;

  let currentBatch = [];
  let currentLength = baseUrl.length + langParam.length + 20; // 20 на прочие символы (?lang=&text=)

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    // Кодируем предложение и оцениваем длину URL, если добавим его
    const encodedSentence = encodeURIComponent(sentence);
    const newLength = currentLength + encodedSentence.length + (currentBatch.length > 0 ? 3 : 0); // +3 для '%0A' (кодировка '\n')

    if (newLength < MAX_URL_LENGTH) {
      currentBatch.push(sentence);
      currentLength = newLength;
    } else {
      // Отправляем текущий пакет предложений
      const translatedText = await sendGetRequest(baseUrl, langParam, currentBatch);
      translatedSentences.push(translatedText);

      // Начинаем новый пакет
      currentBatch = [sentence];
      currentLength = baseUrl.length + langParam.length + encodedSentence.length + 20;
    }
  }

  // Отправляем оставшиеся предложения
  if (currentBatch.length > 0) {
    const translatedText = await sendGetRequest(baseUrl, langParam, currentBatch);
    translatedSentences.push(translatedText);
  }

  // Объединяем переведенные пакеты
  const finalTranslatedText = translatedSentences.join('\n');

  return res_data.length > 1 ? `${res_data[0]}# ${finalTranslatedText}` : finalTranslatedText;
}

// Функция для отправки GET-запроса и получения перевода
async function sendGetRequest(baseUrl, langParam, sentences) {
  const textParam = sentences.join('\n');
  const encodedText = encodeURIComponent(textParam);

  const url = `${baseUrl}?lang=${encodeURIComponent(langParam)}&text=${encodedText}`;

  try {
    const response = await axios.get(url);
    if (response.data.code !== 200) {
      console.log(`Ошибка перевода. Код ответа: ${response.data.code}`);
      return sentences.join('\n'); // Возвращаем оригинальные предложения в случае ошибки
    }

    return response.data.text.join('\n');
  } catch (e) {
    console.log(`Ошибка при запросе перевода: ${e}`);
    return sentences.join('\n'); // Возвращаем оригинальные предложения в случае ошибки
  }
}

// Функция для рекурсивного перевода объекта или массива
async function toTranslate(res, lng, isArray = false, isJson = false, isJs = false) {
  let text = isArray ? '[' : '{\n';
  const keys = Object.keys(res);

  for (let i = 0; i < keys.length; i++) {
    const el = keys[i];
    const value = res[el];

    if (!isArray) {
      text += `"${el}": `;
    }

    if (typeof value === 'string') {
      const translated = await translate(lng, value);
      const isMultiline = translated.includes('\n');

      if (isJs && isMultiline || isJs && translated.indexOf('"') > -1) {
        text += `\`${translated}\``;
      } else {
        text += isMultiline ? `\`${translated}\`` : `"${translated}"`;
      }
    } else if (Array.isArray(value)) {
      const nestedArray = value.map(async (item) => {
        if (typeof item === 'string') {
          const translatedItem = await translate(lng, item);
          const isMultiline = translatedItem.includes('\n');

          return isJs && isMultiline ? `\`${translatedItem}\`` : `"${translatedItem}"`;
        } else if (typeof item === 'object') {
          return await toTranslate(item, lng, true, isJson, isJs);
        }
        return item;
      });

      text += `[${(await Promise.all(nestedArray)).join(', ')}]`;
    } else if (typeof value === 'object' && value !== null) {
      text += await toTranslate(value, lng, false, isJson, isJs);
    } else {
      text += value;
    }

    if (i < keys.length - 1) {
      text += isArray ? ', ' : ',\n';
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  text += isArray ? ']' : '\n}';
  return text;
}

// Основная функция локализации
async function main() {
  try {
    const answer = await input(lang === 'ru' ? 'Укажите имя файла в папке lng. Например, text.json' : 'Specify the name of the file in the lng folder. For example, text.json');

    const [filename, format] = answer.split('.');
    if (!filename || !format) {
      console.log('Некорректный формат файла. Убедитесь, что указано имя файла с расширением.');
      rli.close();
      return;
    }

    const filePath = path.join(process.cwd(), 'lng', answer);
    let res;
    let isJs = false;
    let start_file = '';

    if (format === 'json') {
      res = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } else if (format === 'js') {
      res = require(filePath);
      start_file = 'module.exports = ';
      isJs = true;
    } else {
      res = fs.readFileSync(filePath, "utf8");
    }

    const datetime = new Date().getTime();
    const outputDir = path.join(process.cwd(), 'lng', `${filename}-${format}-${datetime}`);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Запуск перевода на ${lngs.join(', ')}...`);

    const translations = [];
    const pauseDuration = 1000; // Пауза между переводами в миллисекундах
    const totalLngs = lngs.length;

    for (let index = 0; index < lngs.length; index++) {
      const lng = lngs[index];
      let text = '';
      if (format === 'json' || format === 'js') {
        text = `${start_file}${await toTranslate(res, lng, false, true, isJs)}`;
      } else {
        const strs = res.split('\n');
        text = '';
        for (let i = 0; i < strs.length; i++) {
          const str = strs[i];
          if (str.trim() === '') {
            text += '\n';
            continue;
          }

          const translatedStr = await translate(lng, str);
          const isMultiline = translatedStr.includes('\n');
          text += isJs && isMultiline ? `${translatedStr}\n` : `"${translatedStr}"\n`;
          await new Promise(resolve => setTimeout(resolve, pauseDuration));
        }
      }

      const outputFilePath = path.join(outputDir, `${lng}.${format}`);
      fs.writeFileSync(outputFilePath, text, 'utf8');
      translations.push(lng);

      // Вычисление процента завершения
      const percentage = Math.round(((index + 1) / totalLngs) * 100);
      console.log(`Перевод на язык ${lng} завершен. Прогресс: ${percentage}%`);

      // Пауза между переводами
      await new Promise(resolve => setTimeout(resolve, pauseDuration));
    }

    console.log(`Переводы завершены для: ${translations.join(', ')}`);
    await input('Для закрытия нажмите Enter...' || 'Press Enter to close...');
    rli.close();

  } catch (error) {
    console.error(`Произошла ошибка: ${error}`);
    rli.close();
  }
}

main();