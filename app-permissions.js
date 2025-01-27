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
      // 'headers': {
      //   'Accept': 'application/ld+json'
      // }
    });
    const links = await res.json();
    console.log(links);
  }
}
