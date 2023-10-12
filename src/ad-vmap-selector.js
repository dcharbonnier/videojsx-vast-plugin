import { linearFn } from "./utils";

export class AdVmapSelector {
  /**
   *
   * @param {object} vmapResponse
   * @return {object[]}
   */
  selectAds(vmapResponse) {
    if (!vmapResponse.ads || vmapResponse.ads.length === 0) {
      throw new Error("no ads found in VAST");
    }

    const adsWithLinear = vmapResponse.ads.filter((ad) =>
      ad.creatives.some(linearFn)
    );

    if (!adsWithLinear.length) {
      throw new Error("no linear ads found in VAST");
    }

    const adPod = adsWithLinear.filter((ad) => ad.sequence);

    if (adPod.length) {
      return adPod.sort((ad1, ad2) => ad1.sequence - ad2.sequence);
    } else {
      const standaloneAds = adsWithLinear.filter((ad) => !adPod.includes(ad));
      return standaloneAds.slice(0, 1);
    }
  }
}
