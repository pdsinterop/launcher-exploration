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
    if (person.length !== 1) {
      throw new Error('Unexpexted RDF in WebID Profile Document - not one Person');
    }
    const privateTypeIndexes = person[0]['http://www.w3.org/ns/solid/terms#privateTypeIndex'];
    const publicTypeIndexes = person[0]['http://www.w3.org/ns/solid/terms#publicTypeIndex'];
    return privateTypeIndexes.concat(publicTypeIndexes).map(indexThing => indexThing['@id']);
  }
  async getRegistrations(typeIndex, rdfClass) {
    const res = await this.fetch(typeIndex, {
      'headers': {
        'Accept': 'application/ld+json'
      }
    });
    const things = await res.json();
    console.log(things);
  }
}

// const x = await session.fetch('https://asdf.pivot.pondersource.com/settings/publicTypeIndex.ttl', { headers: { Accept: 'application/ld+json' }});
// const things = await x.json();
// console.log(things);