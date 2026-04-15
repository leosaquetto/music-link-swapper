export function createSpotifyResolver(deps = {}) {
  const {
    canonicalizeMediaUrl,
    fetchSpotifyMetadata,
    buildSpotifyQueryFromMetadata,
    resolveAnchoredSpotifyInputArtist,
    resolveAnchoredSpotifyInputTitle,
    resolveSpotifyInputArtistFallback,
    resolveSpotifyInputAlbumFallback,
    resolveSpotifyTrackEntityFromInput,
    fetchAppleMusicLinkFromItunes,
    dedupeAndNormalizeLinks,
    fetchSongLink,
    mergeLinkResults,
    buildSpotifyInputCanonicalMetadata,
    pickBestMetadata,
    extractSpotifyTrackId,
    fetchSpotifyAnonymousToken,
    fetchSpotifySearchDesktopTracks,
    rankSpotifyTrackCandidates,
    isStrongTitleMatch,
    normalizeSearchText
  } = deps;

  async function resolveSpotifyFromSpotifyInput(link) {
    const spotifyUrl = canonicalizeMediaUrl(link);
    const metadata = await fetchSpotifyMetadata(link);
    const spotifyQuery = buildSpotifyQueryFromMetadata(metadata);
    let anchoredArtist = await resolveAnchoredSpotifyInputArtist(link, metadata);
    const anchoredTitle = resolveAnchoredSpotifyInputTitle(metadata, spotifyQuery);
    let anchoredAlbum = String(metadata?.album || "").trim();
    const fallbackArtistForQuery = resolveSpotifyInputArtistFallback(metadata);
    const fallbackAlbumForQuery = resolveSpotifyInputAlbumFallback(metadata);
    const spotifyTrackEntityResolution = await resolveSpotifyTrackEntityFromInput(link, anchoredTitle);
    const spotifyTrackEntity = spotifyTrackEntityResolution.track;
    const hasStrongSpotifyIdentity = Boolean(
      spotifyTrackEntity &&
        String(spotifyTrackEntity.title || "").trim() &&
        String(spotifyTrackEntity.artists?.[0] || "").trim() &&
        String(spotifyTrackEntity.album || "").trim()
    );
    const crossResolutionAllowed = hasStrongSpotifyIdentity;

    if (!anchoredArtist && spotifyTrackEntity?.artists?.length) anchoredArtist = spotifyTrackEntity.artists[0];
    if (!anchoredAlbum && spotifyTrackEntity?.album) anchoredAlbum = spotifyTrackEntity.album;
    if (!anchoredArtist) anchoredArtist = fallbackArtistForQuery;
    if (!anchoredAlbum) anchoredAlbum = fallbackAlbumForQuery;

    const spotifyTrackQuery =
      [anchoredTitle, anchoredArtist || anchoredAlbum].filter(Boolean).join(" ").trim() || spotifyQuery.query;

    const appleMusicResult =
      crossResolutionAllowed && spotifyTrackQuery
        ? await fetchAppleMusicLinkFromItunes(spotifyTrackQuery, {
            title: anchoredTitle || spotifyQuery.title,
            artist: anchoredArtist || spotifyQuery.artist || anchoredAlbum,
            query: spotifyTrackQuery
          })
        : { url: "", isVerified: false, artist: "", title: "", album: "" };

    const links = [
      {
        type: "spotify",
        url: spotifyUrl,
        isVerified: true,
        isProtected: true,
        source: "input"
      }
    ];
    if (appleMusicResult?.url) {
      links.push({
        type: "appleMusic",
        url: canonicalizeMediaUrl(appleMusicResult.url),
        isVerified: Boolean(appleMusicResult.isVerified),
        isProtected: Boolean(appleMusicResult.isVerified),
        source: "itunes_lookup"
      });
    }

    let mergedLinks = dedupeAndNormalizeLinks(links);
    const bridgeSourceUrl = crossResolutionAllowed ? appleMusicResult?.url || spotifyUrl : "";
    let bridgeResult = { ok: false };
    if (bridgeSourceUrl) {
      bridgeResult = await fetchSongLink(bridgeSourceUrl, { markVerified: true, protectVerified: true });
      if (bridgeResult.ok) {
        mergedLinks = mergeLinkResults({ links: mergedLinks }, bridgeResult.data).links;
      }
    }

    const songLinkArtist = String(bridgeResult?.data?.description || "").split("•")[0].trim();
    const songLinkAlbum = String(bridgeResult?.data?.album || "").trim();
    const canonicalMetadata = buildSpotifyInputCanonicalMetadata({
      spotifyTrackEntity,
      spotifyTitle: anchoredTitle,
      entityFailed: Boolean(spotifyTrackEntityResolution.failed)
    });
    const metadataPayload = pickBestMetadata(
      {
        title: canonicalMetadata.title || "música encontrada",
        description: canonicalMetadata.artist || songLinkArtist || "",
        album: canonicalMetadata.album || songLinkAlbum || "",
        image: metadata?.image || ""
      },
      bridgeResult.ok ? bridgeResult.data : {},
      {}
    );
    metadataPayload.title = canonicalMetadata.title || metadataPayload.title;
    metadataPayload.description = canonicalMetadata.artist || "";
    metadataPayload.album = canonicalMetadata.album || "";

    return {
      ok: true,
      status: 200,
      data: {
        ...metadataPayload,
        _lockArtist: true,
        _canonicalTitle: canonicalMetadata.title || "",
        _canonicalArtist: canonicalMetadata.artist || "",
        _canonicalAlbum: canonicalMetadata.album || "",
        _canonicalImage: String(metadata?.image || "").trim(),
        _canonicalMetadataSource: canonicalMetadata.source || "",
        _lockCanonicalMetadata: true,
        _resolvedTitle: canonicalMetadata.title || metadataPayload.title || "",
        _resolvedArtist: canonicalMetadata.artist || metadataPayload.description || "",
        _resolvedAlbum: canonicalMetadata.album || metadataPayload.album || "",
        _resolvedImage: String(metadata?.image || "").trim() || metadataPayload.image || "",
        _resolvedMetadataSource: canonicalMetadata.source || "spotify_input",
        _spotifyEntityFailed: Boolean(spotifyTrackEntityResolution.failed),
        _spotifyEntityStatus: String(spotifyTrackEntityResolution.status || ""),
        _spotifyEntityTrackId: String(spotifyTrackEntity?.id || extractSpotifyTrackId(link) || "").trim(),
        _spotifyEntityTitle: String(spotifyTrackEntity?.title || "").trim(),
        _spotifyEntityArtist: String(spotifyTrackEntity?.artists?.[0] || "").trim(),
        _spotifyEntityAlbum: String(spotifyTrackEntity?.album || "").trim(),
        _spotifyFallbackArtist: String(fallbackArtistForQuery || "").trim(),
        _spotifyFallbackAlbum: String(fallbackAlbumForQuery || "").trim(),
        _spotifyFallbackArtistForQuery: String(fallbackArtistForQuery || "").trim(),
        _spotifyFallbackAlbumForQuery: String(fallbackAlbumForQuery || "").trim(),
        _spotifyCrossResolutionAllowed: Boolean(crossResolutionAllowed),
        links: mergedLinks
      }
    };
  }

  async function resolveSpotifyFromTrustedMetadata({ title = "", artist = "", album = "", image = "" } = {}) {
    const query = [String(title || "").trim(), String(artist || "").trim()].filter(Boolean).join(" ").trim();
    const debug = {
      query,
      title: String(title || "").trim(),
      artist: String(artist || "").trim(),
      album: String(album || "").trim(),
      resolutionType: "none"
    };
    if (!query) return { resolutionType: "none", spotifyLink: null, metadata: { title, artist, album, image }, debug };

    try {
      const accessToken = await fetchSpotifyAnonymousToken();
      if (!accessToken) return { resolutionType: "none", spotifyLink: null, metadata: { title, artist, album, image }, debug };
      const candidates = await fetchSpotifySearchDesktopTracks(accessToken, query);
      if (!candidates.length) {
        return {
          resolutionType: "search_fallback",
          spotifyLink: { type: "spotify", url: `https://open.spotify.com/search/${encodeURIComponent(query)}`, isVerified: false },
          metadata: { title, artist, album, image },
          debug: { ...debug, resolutionType: "search_fallback" }
        };
      }
      const best = rankSpotifyTrackCandidates(candidates, { title, artist, album });
      const minimumScore = artist ? 72 : 78;
      if (!best?.url || best.score < minimumScore) {
        return {
          resolutionType: "search_fallback",
          spotifyLink: { type: "spotify", url: `https://open.spotify.com/search/${encodeURIComponent(query)}`, isVerified: false },
          metadata: { title, artist, album, image },
          debug: { ...debug, resolutionType: "search_fallback" }
        };
      }
      if (title && !isStrongTitleMatch(normalizeSearchText(title), normalizeSearchText(best.title))) {
        return {
          resolutionType: "search_fallback",
          spotifyLink: { type: "spotify", url: `https://open.spotify.com/search/${encodeURIComponent(query)}`, isVerified: false },
          metadata: { title, artist, album, image },
          debug: { ...debug, resolutionType: "search_fallback" }
        };
      }
      return {
        resolutionType: "final_link",
        spotifyLink: { type: "spotify", url: best.url, isVerified: true, source: "spotify_direct_search" },
        metadata: { title, artist, album, image },
        debug: { ...debug, resolutionType: "final_link", score: Number(best.score || 0) }
      };
    } catch (_error) {
      return { resolutionType: "none", spotifyLink: null, metadata: { title, artist, album, image }, debug };
    }
  }

  return { resolveSpotifyFromSpotifyInput, resolveSpotifyFromTrustedMetadata };
}
