const fs = require('fs');
const rli = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});
const axios = require('axios');
const conf = JSON.parse(fs.readFileSync(`config.json`, "utf8"));
const lngs = conf.languages;
const lang = conf.app_language;

async function translate(lng, text, isArray = true) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (/^\d+$/.test(text)) {
    return `"${text}"`;
  }

  let res = `"${text}"`;
  let res_data = [];
  if (text.indexOf('# ') > -1) res_data = text.split('# ');
  if (res_data.length > 0) {
    text = res_data[1];
  }
  let url;
  try {
    url = `${conf.translate_url}?lang=ru-${lng}&text=${encodeURIComponent(text)}`;
  } catch (error) {
    console.log(`Error while encoding URL: ${error}`);
    return text;
  }

  try {
    let response = await axios.get(url);
    if (response.data.code !== 200) return '';
    res = `"${response.data.text[0]}"`;
    if (res_data.length > 0) {
      res = `${res_data[0]}# ${response.data.text[0]}`;
    }
    if (isArray) {
      res = `"${response.data.text[0]}"`;
      if (res.indexOf('\n') > -1) res = `\`${response.data.text[0]}\``;
    }
  } catch (e) {
    console.log(`Error while translating URL (${url}): ${e}`);
  }
  return res;
}

async function toTranslate(res, lng, fileData, isArray = false, isJson = false) {
  await new Promise(r => setTimeout(r, 1000));
  let text;
  if (isArray === false) {
    text = `{\n`;
  } else {
    text = '[';
  }
  let keys = Object.keys(res);
  for (let i = 0; i < keys.length; i++) {
    let el = keys[i];
    if (typeof el !== 'number' && isNaN(el)) text += `"${el}": `;
    if (typeof res[el] === 'string') {
      if (isJson == true) {
        let percent = (i / keys.length) * 100;
        console.log(`${lng}: ${percent.toFixed(2)}%`);
      }
      if (isArray == true) {
        if (el === '0' && (/[a-zA-Z]/.test(res[el]) || isNaN(parseFloat(res[el])))) {
          text += `"${res[el]}"`;
        } else {
          text += `${await translate(lng, res[el])}`;
        }
        if (i < keys.length - 1) {
          text += ',';
        }
      } else {
        text += `${await translate(lng, res[el])}`;
        if (i < keys.length - 1) {
          text += ',\n';
        }
      }
    } else if (Array.isArray(res[el])) {
      let arr = '[';
      for (let n in res[el]) {
        let l = res[el][n];
        if (typeof l === 'string') {
          if (n === 0 && (/[a-zA-Z]/.test(l) || isNaN(parseFloat(l)))) {
            arr += `${l}`;
          } else {
            arr += `${await translate(lng, l)}`;
          }
          if (n < res[el].length - 1) {
            arr += ',';
          }
        } else {
          arr += `${await toTranslate(l, lng, fileData, true)}`;
          if (n < res[el].length - 1) {
            arr += ', ';
          }
        }
      }
      arr += ']';
      text += `${arr}`;
      if (i < keys.length - 1) {
        text += ',\n';
      }
    } else if (typeof res[el] === 'object' && !Array.isArray(res[el])) {
      let percent = (i / keys.length) * 100;
      console.log(`${lng}: ${percent.toFixed(2)}%`);
      text += `${await toTranslate(res[el], lng, fileData)}`
      if (i < keys.length - 1) {
        text += ',\n';
      }
    } else {
      text += `${res[el]}`;
      if (i < keys.length - 1) {
        text += ',\n';
      }
    }
  }
  if (isArray === false) {
    text += `\n}`;
  } else {
    text += `]`;
  }
  return text;
}

function input(prompt) {
  return new Promise((callbackFn, errorFn) => {
    rli.question(prompt, (uinput) => {
      callbackFn(uinput);
    }, () => {
      errorFn();
    });
  });
}

let q = '';
let starting = '';
let finish_q = '';
if (lang == 'en') {
  q = 'Specify the name of the file located in the lng folder. For example, text.json';
  starting = 'Launching a translation to';
  finish_q = 'To close, press Enter.';
} else if (lang === 'zh') {
  q = `指定位于lng文件夹中的文件的名称。 例如，文本。json格式`;
  starting = `启动转移到`;
  finish_q = `要关闭，请按Enter键.`;
} else if (lang === 'es') {
  q = `Especifique el nombre del archivo que se encuentra en la carpeta lng. Por ejemplo, text.json`;
  starting = `Iniciar la traducción a`;
  finish_q = `Para cerrar, presione la tecla Intro.`;
} else if (lang === 'ar') {
  q = `حدد اسم الملف الموجود في مجلد الغاز الطبيعي المسال. على سبيل المثال ، النص.جسون`;
  starting = `إطلاق نقل إلى`;
  finish_q = `للإغلاق ، اضغط على إدخال...`;
} else if (lang === 'ko') {
  q = `파일 이름을 지정합니다. 예:텍스트.제이슨`;
  starting = `다음으로 전송 시작`;
  finish_q = `닫으려면 엔터 키를 누릅니다...`;
} else if (lang === 'ru') {
  q = 'Укажите имя файла, находящегося в папке lng. Например, text.json';
  starting = 'Запуск перевода на';
  finish_q = 'Для закрытия нажмите Enter...';
}

async function main() {
  let answer = await input(q);
  let res = {};
  let [filename, format] = answer.split('.');
  let start_file;
  if (answer.split('.')[1] === 'json') {
    res = JSON.parse(fs.readFileSync(`${process.cwd()}/lng/${answer}`, "utf8"));
    start_file = '';
  } else if (answer.split('.')[1] === 'js') {
    res = require(`${process.cwd()}/lng/${answer}`);
    start_file = 'module.exports = ';
  } else {
    res = fs.readFileSync(`lng/${answer}`, "utf8");
  }

  let datetime = new Date().getTime();
  if (!fs.existsSync(`${process.cwd()}/lng/${filename}-${format}-${datetime}`)) {
    fs.mkdirSync(`${process.cwd()}/lng/${filename}-${format}-${datetime}`); //Create dir in case not found
  }

  console.log(`${starting} ${lngs.join(', ')}...`);
  const translations = await Promise.all(
    lngs.map(async (lng) => {
      let text = '';
      if (typeof start_file !== 'undefined') {
        if (format === 'json') {
          let translated = await toTranslate(res, lng, res, false, true);
          text = `${start_file}\n${translated}`;
        } else {
          let translated = await toTranslate(res, lng, res);
          text = `${start_file}\n${translated}`;
        } // is no json.
      } else {
        let strs = res.split('\n');
        text = '';
        for (let l in strs) {
          let str = strs[l];
          let percent = ((parseInt(l) + 1) / strs.length) * 100;
          console.log(`${lng}: ${percent.toFixed(2)}%`);
          if (str === '') {
            text += `\n`;
          } else {
            if (/[а-яА-ЯЁё]/.test(str)) {
              text += `${await translate(lng, str, false)}\n`;
            } else {
              text += `${str}\n`;
            }
          }
        }
      }
      fs.writeFileSync(`${process.cwd()}/lng/${filename}-${format}-${datetime}/${lng}.${format}`, text);
      return lng;
    })
  );

  console.log(`Translations completed for: ${translations.join(', ')}`);
  await input(finish_q);
  rli.close();
}

main();
