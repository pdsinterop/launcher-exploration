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
    const typeRegistrations = things.filter(x => (x['@type'].indexOf('http://www.w3.org/ns/solid/terms#TypeRegistration') !== -1));
    const matching = typeRegistrations.filter(x => {
      const classes = x['http://www.w3.org/ns/solid/terms#forClass'];
      for (let i = 0; i < classes.length; i++) {
        if (classes[i]['@id'] === rdfClass) {
          return true;
        }
      }
      return false;
    });
    let instances = [];
    let instanceContainers = [];
    matching.forEach(entry => {
      if (Array.isArray(entry['http://www.w3.org/ns/solid/terms#instance'])) {
        for (let i = 0; i < entry['http://www.w3.org/ns/solid/terms#instance'].length; i++) {
          instances.push(entry['http://www.w3.org/ns/solid/terms#instance'][i]['@id']);
        }
      }
      if (Array.isArray(entry['http://www.w3.org/ns/solid/terms#instanceContainer'])) {
        for (let i = 0; i < entry['http://www.w3.org/ns/solid/terms#instanceContainer'].length; i++) {
          instanceContainers.push(entry['http://www.w3.org/ns/solid/terms#instanceContainer'][i]['@id']);
        }
      }
    })
    return { instances, instanceContainers };
  }
  async getInstancesAndContainers(rdfClass) {
    const typeIndexes = await this.getTypeIndexes();
    let instances = [];
    let instanceContainers = [];
    const promises = typeIndexes.map(async ti => {
      const result = await this.getRegistrations(ti, rdfClass);
      instances = instances.concat(result.instances);
      instanceContainers = instances.concat(result.instanceContainers);
    });
    await Promise.all(promises);
    return { instances, instanceContainers };
  }
  async editAcr(appId, acr) {
    const read = await this.fetch(acr, {
      'headers': {
        'Accept': 'application/ld+json'
      }
    });
    const authorizations = await read.json();
    console.log(authorizations, `let's add ${appId} here!`);
  }
  async installApp(appId, rdfClass) {
    const {instances, instanceContainers } = await this.getInstancesAndContainers(rdfClass);
    const instancePromises = instances.map(instance => this.editAcr(appId, `${instance}.acr`)); // FIXME: don't make assumptions about ACR location
    const instanceContainerPromises = instanceContainers.map(instanceContainer => this.editAcr(appId, `${instanceContainer}.acr`)); // FIXME: don't make assumptions about ACR location
    await Promise.all(instancePromises.concat(instanceContainerPromises));
  }
}

// const x = await session.fetch('https://asdf.pivot.pondersource.com/settings/publicTypeIndex.ttl', { headers: { Accept: 'application/ld+json' }});
// const x = await session.fetch('https://asdf.pivot.pondersource.com/settings/publicTypeIndex.ttl');
// const things = await x.json();
// console.log(things);