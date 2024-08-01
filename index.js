const reader = require('xlsx');
const fs = require('fs');

const dir = './translations';
const locales = [
  'en_US',
  'es_ES',
  'ja_JP',
  'ko_KR',
  'pt_BR',
  'zh_CN',
  'zh_TW',
  'it_IT',
  'fr_FR',
  'de_DE',
];
let countriesWithIds = {}; // 250 entries
let countriesTranslations = [];
let statesTranslations = [];
let citiesTranslations = [];
let districtsTranslations = [];
let notFoundCountries = [];
let notFoundStatesWithLocale = [];
let notFoundStates = new Set();

const readFile = (directory) => {
  const file = reader.readFile(directory);
  const sheet = file.SheetNames[0];
  const content = reader.utils.sheet_to_json(file.Sheets[sheet]);
  return content;
};

const readTranslations = () => {
  countriesTranslations = readFile('./resources/country.xlsx');
  statesTranslations = readFile('./resources/province_state.xlsx');
  citiesTranslations = readFile('./resources/city.xlsx');
  districtsTranslations = readFile('./resources/multi_city_vicinity.xlsx');

  countriesTranslations
    .filter(({ locale }) => locale === 'en-US')
    .forEach((el) => (countriesWithIds[el.short_name] = el.gaia_id));
};

const writeCountryTranslation = (transId, string) => {
  const countryId = countriesWithIds[string];
  if (countryId) {
    const list = countriesTranslations.filter((el) => el.gaia_id == countryId);

    locales.forEach((locale) => {
      const localizedName = list.find(
        (line) => line.locale.replace('-', '_') === locale
      ).short_name;

      const stringToAppend = `${transId}=${localizedName}\n`;
      fs.appendFileSync(getFileName(locale), stringToAppend);
    });
  } else {
    notFoundCountries.push(string);
    fs.appendFileSync(getFileName('en_US'), `${transId}=${string}\n`);
  }
};

const writeStateTranslation = (transId, gaia_id, tags) => {
  let list;

  if (tags.includes('geo-admin:city')) {
    list = citiesTranslations.filter((el) => el.gaia_id == gaia_id);
  } else if (tags.includes('geo-admin:district')) {
    list = districtsTranslations.filter((el) => el.gaia_id == gaia_id);
  }

  if (!list || list.length === 0) {
    list = statesTranslations.filter((el) => el.gaia_id == gaia_id);
  }

  locales.forEach((locale) => {
    const translationFound = list.find(
      (line) => line.locale.replace('-', '_') === locale
    );
    if (translationFound) {
      const localizedName = translationFound.short_name;
      const stringToAppend = `${transId}=${localizedName}\n`;

      fs.appendFileSync(getFileName(locale), stringToAppend);
    } else {
      notFoundStatesWithLocale.push(`${locale}, ${gaia_id}`);
      notFoundStates.add(gaia_id);
    }
  });
};

const getTranslationID = (type, name) => {
  const replacements = {
    æ: 'ae',
    ø: 'o',
    ð: 'd',
  };
  // let nameNormalized = name.replace(/['.,ʻ]/g, '');

  // const nameNormalized = nameWithoutSpecialChars
  //   .normalize('NFD')
  //   .replace(/[\u0300-\u036f]/g, '');

  const nameNormalized = name
    .toLowerCase()
    .replace(/['.,ʻ]/g, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\u0000-\u007F]/g, (char) => replacements[char] || '');
  console.log(name, nameNormalized);
  return `eg.console.api.payment.${type}.${nameNormalized
    .split(/[- ]/g)
    .join('.')}`;
};
const getFileName = (locale) => `${dir}/messages_${locale}.properties`;

const readSpreadsheets = () => {
  const file = reader.readFile('./resources/iso3166-2_final.xlsx');
  const [statesList, countriesList] = file.SheetNames;
  let countries = [];

  const tempCountries = reader.utils.sheet_to_json(file.Sheets[countriesList]);
  const tempStates = reader.utils.sheet_to_json(file.Sheets[statesList]);

  tempCountries.forEach((res) => {
    const name = res.name.trim();
    const translationID = getTranslationID('country', name);
    const country = {
      name,
      code: res.code,
      translationID,
    };
    countries.push({ country, states: [] });
    writeCountryTranslation(translationID, name);
  });

  tempStates.forEach((res) => {
    const { gaia_id, short_name, country, prov, tags } = res;
    const name = short_name.trim();
    if (country !== 'null') {
      const translationID = getTranslationID('state', name);
      const countryIdx = countries.findIndex(
        (el) => el.country.code === country
      );
      const province = prov === 'N/A' || prov === 'null' ? '' : prov;
      const state = {
        name,
        code: province,
        GaiaId: gaia_id,
        translationID,
      };

      countries[countryIdx].states.push(state);
      writeStateTranslation(translationID, gaia_id, tags);
    }
  });

  return countries;
};

const writeJSON = (data, fileName) => {
  const fileExists = fs.existsSync(fileName);
  if (fileExists) {
    fs.unlink(`${fileName}`, () => {
      console.log('deleted');
    });
  }
  let json = JSON.stringify({ data }, null, 4);
  const cb = (err) => {
    if (err) throw err;
    console.log('complete');
  };
  fs.writeFile(fileName, json, cb);
};

const prepareTranslationFiles = () => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (fs.existsSync('./output')) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    locales.forEach((locale) => fs.writeFileSync(getFileName(locale), ''));
  }
  // locales.forEach((locale) =>
  //   fs.truncate(getFileName(locale), 0, () => console.log('clear files'))
  // );
};

const printNotFound = () => {
  // fs.writeFileSync(
  //   './output/notFoundStates.json',
  //   JSON.stringify({ notFoundStatesWithLocale }, null, 4)
  // );
  const translationNotFound = notFoundStatesWithLocale.reduce((obj, val) => {
    const itemId = val.split(' ')[1];
    const currCount = obj[itemId] ?? 0;
    obj[itemId] = currCount + 1;
    return obj;
  }, Object.create(null));
  Object.entries(translationNotFound).forEach(([key, value]) => {
    if (value > 9) {
      console.log(key);
    }
  });
};

const init = () => {
  readTranslations();
  prepareTranslationFiles();

  const countries = readSpreadsheets();

  writeJSON(countries, './output/countries_states.json');

  // console.log(translationNotFound);
  // writeStateTranslation('state', '3000652709', '["geo-admin:province"]');
  printNotFound();

  // console.log(notFoundStates.size);
};

init();
