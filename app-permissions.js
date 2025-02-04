const available = {
  'https://poddit.app/clientid.jsonld': {
    scopes: ['http://www.w3.org/2002/01/bookmark#Bookmark'],
    launch: 'https://poddit.app',
  }
};

class AppInstaller {
  constructor({ fetch, webId }) {
    this.fetch = fetch;
    this.webId = webId;
    this.things = {};
    this.registrations = {};
  }
  async ensureDoc(url) {
    if (typeof this.things[url] === 'undefined')  {
      const res = await this.fetch(url, {
        'headers': {
          'Accept': 'application/ld+json'
        }
      });
      this.things[url] = await res.json();
    }
  }
  async putBack(url) {
    this.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/ld+json'
      },
      body: JSON.stringify(this.things[url], null, 2)
    });
  }
  async getTypeIndexes() {
    await this.ensureDoc(this.webId);
    const person = this.things[this.webId].filter(x => { console.log(x); return (x['@type'].indexOf('http://xmlns.com/foaf/0.1/Person') !== -1); });
    if (person.length !== 1) {
      throw new Error('Unexpexted RDF in WebID Profile Document - not one Person');
    }
    const privateTypeIndexes = person[0]['http://www.w3.org/ns/solid/terms#privateTypeIndex'];
    const publicTypeIndexes = person[0]['http://www.w3.org/ns/solid/terms#publicTypeIndex'];
    return privateTypeIndexes.concat(publicTypeIndexes).map(indexThing => indexThing['@id']);
  }
  async getRegistrations(typeIndex, rdfClass) {
    await this.ensureDoc(typeIndex);
    const typeRegistrations = this.things[typeIndex].filter(x => (x['@type'].indexOf('http://www.w3.org/ns/solid/terms#TypeRegistration') !== -1));
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
    return instances.concat(instanceContainers);
  }
  async getMatcher(appId, acr) {
    await this.ensureDoc(acr);
    const things = this.things[acr];
    for (let i = 0; i < things.length; i++) {
      if ((Array.isArray(things[i]['@type'])) && (things[i]['@type'].indexOf('http://www.w3.org/ns/solid/acp#Matcher') !== -1)) {
        console.log('thing is a matcher', things[i]['@id']);
        let webIdMatch = false;
        if (Array.isArray(things[i]['http://www.w3.org/ns/solid/acp#agent'])) {
          for (let j = 0; j < things[i]['http://www.w3.org/ns/solid/acp#agent'].length; j++) {
            if (things[i]['http://www.w3.org/ns/solid/acp#agent'][j]['@id'] === this.webId) {
              webIdMatch = true;
              break;
            }
          }
        }
        if (webIdMatch) {
          console.log('thing is a matcher for the right webId', this.webId);
          let clientIdMatch = false;
          if (Array.isArray(things[i]['http://www.w3.org/ns/solid/acp#client'])) {
            for (let j = 0; j < things[i]['http://www.w3.org/ns/solid/acp#client'].length; j++) {
              if (things[i]['http://www.w3.org/ns/solid/acp#client'][j]['@id'] === appId) {
                clientIdMatch = true;
                break;
              }
            }
          }
          if (clientIdMatch) {
            console.log('thing is a matcher for the right clientId', appId);
            return things[i]['@id'];
          }
        }
      }
    }
    throw new Error('no matching matcher found');
  }
  async acrNeedsEditing(appId, acr, fix = false) {
    console.log('checking ACR', appId, acr);
    const matcher = await this.getMatcher(appId, acr);
    if (typeof matcher !== 'string') {
      throw new Error('why is matcher not a string?');
    }
    // await this.ensureDoc(acr);
    console.log('matcher found! now let\'s find the policy', matcher, this.things, acr);
    const things = this.things[acr];
    for (let i = 0; i < things.length; i++) {
      if (Array.isArray(things[i]['@type']) && things[i]['@type'].indexOf('http://www.w3.org/ns/solid/acp#Policy') !== -1) {
        if (Array.isArray(things[i]['http://www.w3.org/ns/solid/acp#anyOf'])) {
          console.log('policy found!', things[i]['@id']);
          for (let j = 0; j < things[i]['http://www.w3.org/ns/solid/acp#anyOf'].length; j++) {
            if (things[i]['http://www.w3.org/ns/solid/acp#anyOf'][j]['@id'] === matcher) {
              console.log('app already has access!', acr);
              return false;
            }
          }
          if (fix) {
            things[i]['http://www.w3.org/ns/solid/acp#anyOf'].push({
              '@id': matcher
            });
          }
        }
      }
    }
    if (fix) {
      console.log("Writing updated ACR", things);
      this.things[acr] = things;
      this.putBack(acr);
    }
    return true;
  }
  async isInstalled(appId, fix = false) {
    let ok = true;
    const rdfClass = available[appId].scopes[0]; // FIXME: support multiple scopes
    const instances = await this.getInstancesAndContainers(rdfClass);
    const promises = instances.map(async instance => {
      const acrUrl = `${instance}.acr`; // FIXME: don't make assumptions about ACR location
      if (await this.acrNeedsEditing(appId, acrUrl, fix)) {
        console.log('ACR not OK', acrUrl);
        ok = false;
      } else {
        console.log('ACR is OK', acrUrl);
      }
    });
    await Promise.all(promises);
    return ok;
  }
  async installApp(appId) {
    await this.isInstalled(appId, true);
  }
}

// const x = await session.fetch('https://asdf.pivot.pondersource.com/settings/publicTypeIndex.ttl', { headers: { Accept: 'application/ld+json' }});
// const x = await session.fetch('https://asdf.pivot.pondersource.com/settings/publicTypeIndex.ttl');
// const things = await x.json();
// console.log(things);