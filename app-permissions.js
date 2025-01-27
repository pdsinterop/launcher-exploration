const available = {
  'https://poddit.app/clientid.jsonld': {
    scopes: ['bookmarks'],
    launch: 'https://poddit.app',
  }
};

class AppInstaller {
  constructor({ fetch, webId }) {
    this.fetch = fetch;
    this.webId = webId;
  }
  async getTypeIndexes() {
    const res = await this.fetch(this.webId, {
      'headers': {
        'Accept': 'application/ld+json'
      }
    });
    const things = await res.json();
    const person = things.filter(x => { console.log(x); return (x['@type'].indexOf('http://xmlns.com/foaf/0.1/Person') !== -1); });
    const privateTypeIndexes = person['http://www.w3.org/ns/solid/terms#privateTypeIndex'];
    const publicTypeIndexes = person['http://www.w3.org/ns/solid/terms#publicTypeIndex'];
    return privateTypeIndexes.concat(publicTypeIndexes).map(indexThing => indexThing['@id']);
  }
  async getRegistrations(typeIndex, rdfClass) {}
}
