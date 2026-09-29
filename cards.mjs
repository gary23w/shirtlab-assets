/** Shared server and search-result cards. Artwork keeps its original licence. */
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function collectionButton(asset,{floating=false}={}){
 return `<button type="button" class="collect-control${floating?' collect-float':''}" data-collect="${e(asset.id)}" data-asset-label="${e(asset.label)}" aria-pressed="false" aria-label="Save ${e(asset.label)} to collection" title="Save to collection"><svg class="save-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg><svg class="saved-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span data-collect-label>Save to collection</span></button>`;
}

export function assetCard(asset,{deferPreview=false}={}){
 const preview=deferPreview?`data-preview="${e(new URL(asset.previewUrl).pathname)}"`:`src="${e(asset.previewUrl)}"`;
 return `<li class="asset-card"><div class="card-preview"><a class="preview" href="${e(asset.url)}"><img ${preview} alt="${e(asset.label)}" width="160" height="160" loading="lazy" decoding="async"></a>${collectionButton(asset,{floating:true})}</div><div class="card-text"><a class="asset-title" href="${e(asset.url)}">${e(asset.label)}</a><p>${e(asset.pack.name)} <span class="tag">${e(asset.format.toUpperCase())}</span></p><small>${e(asset.license.spdx)} · ${e(asset.pack.author.name)}</small><div class="card-actions"><a href="${e(asset.downloadUrl)}" download>Download</a><a href="${e(asset.shirtUrl)}">Add to a shirt <span aria-hidden="true">↗</span></a></div></div></li>`;
}
