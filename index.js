const reader = require('xlsx');
const fs = require('fs');

const example = {
  country: {
    name: 'United States',
    code: 'US',
    translationID: 'eg.console.api.payment.country.united.states',
  },
  states: [
    {
      name: 'California',
      code: 'CA',
      GaiaId: '12345',
      translationID: 'eg.console.api.payment.state.california',
    },
    {
      name: 'Texas',
      code: 'TX',
      GaiaId: '67890',
      translationID: 'eg.console.api.payment.state.texas',
    },
  ],
};

const getTranslationID = (type, name) => `eg.console.api.payment.${type}.${name.toLowerCase().split(' ').join('.')}`;

const readSpreadsheets = () => {
  const file = reader.readFile('./states.xlsx');
  const [statesList, countriesList] = file.SheetNames;
  let countries = [];

  for (let i = 0; i < countriesList.length; i++) {
    const temp = reader.utils.sheet_to_json(file.Sheets[countriesList]);
    temp.forEach((res) => {
      const country = {
        name: res.name,
        code: res.code,
        translationID: getTranslationID('country', res.name),
      };
      countries.push({ country, states: [] });
    });
  }
  for (let i = 0; i < statesList.length; i++) {
    const temp = reader.utils.sheet_to_json(file.Sheets[statesList]);

    temp.forEach((res) => {
      const { gaia_id, short_name, country, prov } = res;
      if (country !== 'null') {
        const countryIdx = countries.findIndex((el) => el.country.code === country);
        const province = prov === 'N/A' || prov === 'null' ? '' : prov;
        const state = {
          name: short_name,
          code: province,
          GaiaId: gaia_id,
          translationID: getTranslationID('state', short_name),
        };

        countries[countryIdx].states.push(state);
      }
    });
  }
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

const init = () => {
  const countries = readSpreadsheets();
  writeJSON(countries, 'countries_states.json');
};

init();
