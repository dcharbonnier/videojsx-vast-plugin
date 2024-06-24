import window from "global";
import { companionFn, linearFn, isVmap } from "./utils";
import { VASTClient, VASTParser, VASTTracker } from "@dailymotion/vast-client";
import VMAP from "@dailymotion/vmap";
import { TrackedAd } from "./tracked-ad";

export class AdLoader {
  #vastClient;
  #vastParser;
  #options;
  #adVastSelector;
  #adVmapSelector;

  /**
   *
   * @param {VASTClient} vastClient
   * @param {VASTParser} vastParser
   * @param {AdVastSelector} adVastSelector
   * @param {AdVmapSelector} adVmapSelector
   * @param {object} options
   */
  constructor(vastClient, vastParser, adVastSelector, adVmapSelector, options) {
    this.#vastClient = vastClient;
    this.#vastParser = vastParser;
    this.#adVastSelector = adVastSelector;
    this.#adVmapSelector = adVmapSelector;
    this.#options = options;
  }

  loadAds() {
    return new Promise((accept, reject) => {
      const { url, xml } = this.#options;

      if (!url && !xml) {
        throw new Error("xml or url option must be set");
      }

      const ads = url ? this.loadAdsWithUrl(url) : this.loadAdsWithXml(xml);
      ads.then(accept).catch(reject);
    });
  }

  /**
   *
   * @param {XMLDocument|string} xml
   */
  loadAdsWithXml(xml) {
    if (isVmap(xml)) {
      console.log("loadAdsWithVMAPXml");
      return this.loadAdsWithVMAPXml(xml);
    } else {
      console.log("loadAdsWithVASTXml");
      return this.loadAdsWithVASTXml(xml);
    }
  }

  /**
   *
   * @param {XMLDocument|string} xml
   */
  loadAdsWithVMAPXml(xml) {
    return new Promise((accept, reject) => {
      let xmlDocument;

      if (xml.constructor === window.XMLDocument) {
        xmlDocument = xml;
      } else if (xml.constructor === String) {
        xmlDocument = new window.DOMParser().parseFromString(xml, "text/xml");
      } else {
        throw new Error("xml config option must be a String or XMLDocument");
      }
      try {
        const vmap = new VMAP(xmlDocument);
        resolve(this.#adVmapSelector.selectAds(vmap));
      } catch (error) {
        reject(new Error("Failed to parse VMAP: " + error.message));
      }
    });
  }

  /**
   *
   * @param {XMLDocument|string} xml
   */
  loadAdsWithVASTXml(xml) {
    return new Promise((accept, reject) => {
      let xmlDocument;

      if (xml.constructor === window.XMLDocument) {
        xmlDocument = xml;
      } else if (xml.constructor === String) {
        xmlDocument = new window.DOMParser().parseFromString(xml, "text/xml");
      } else {
        throw new Error("xml config option must be a String or XMLDocument");
      }

      this.#vastParser
        .parseVAST(xmlDocument)
        .then(this.#adVastSelector.selectAds)
        .then(this.#createTrackedAds)
        .then(accept)
        .catch(reject);
    });
  }

  loadAdsWithUrl(url) {
    return new Promise((accept, reject) => {
      this.#vastClient
        .get(url, {
          withCredentials: this.#options.withCredentials,
          wrapperLimit: this.#options.wrapperLimit,
        })
        .then(this.#adVastSelector.selectAds)
        .then(this.#createTrackedAds)
        .then(accept)
        .catch(reject);
    });
  }

  /*** private methods ***/

  #createTrackedAds = (ads) => {
    const createTrackedAd = (ad) => {
      const linearAdTracker = new VASTTracker(
        this.#vastClient,
        ad,
        ad.creatives.find(linearFn),
        ad.creatives.find(companionFn)
      );

      linearAdTracker.on("clickthrough", onClickThrough);

      let companionAdTracker = null;

      const companionCreative = ad.creatives.find(companionFn);

      if (companionCreative) {
        // Just pick the first suitable companion ad for now
        const options = this.#options;
        const variation = companionCreative.variations
          .filter((v) => v.staticResource)
          .filter((v) => v.type.indexOf("image") === 0)
          .find(
            (v) =>
              parseInt(v.width, 10) <= options.companion.maxWidth &&
              parseInt(v.height, 10) <= options.companion.maxHeight
          );

        if (variation) {
          companionAdTracker = new VASTTracker(
            this.#vastClient,
            ad,
            companionCreative,
            variation
          );
          companionAdTracker.on("clickthrough", onClickThrough);
        }
      }

      return new TrackedAd(linearAdTracker, companionAdTracker);
    };

    return ads.map(createTrackedAd);
  };
}

function onClickThrough(url) {
  window.open(url, "_blank");
}
