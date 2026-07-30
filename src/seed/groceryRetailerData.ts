/*
 * Dropped by verify:grocery rather than shipped dead: Sklavenitis (404),
 * Carrefour Kuwait + Puregold PH (unreachable), AEON MY (404), EDEKA (ambiguous 403/404
 * — Germany still has REWE, Aldi, Lidl, Kaufland, Amazon), Whole Foods and
 * Aldi US (moved paths), Sheng Siong (DNS).
 * DK (Nemlig: redirect loop), MY (Lotus's: 404) and PL (Frisco: 404) were
 * authored and then dropped by verify:grocery — a country with no shops gets
 * the copy-list fallback, which beats a confidently dead link.
 */
/**
 * Data only — no imports, no side effects. The seeder writes it to Payload;
 * verify:grocery grades it against the live sites. Kept apart from the seed
 * runner so importing the list can never accidentally run the seed.
 */

export type SeedRetailer = {
  label: string
  slug: string
  type: 'supermarket' | 'delivery' | 'marketplace'
  countries: string[]
  searchUrlTemplate: string
  priority: number
}


/**
 * The registry, ~30 countries. Authored, then graded by `npm run verify:grocery`
 * — every template below was fetched with a real query before seeding; FAILs
 * were fixed or dropped. Majors first per country (priority desc). Affiliate
 * templates stay empty until programs exist; they layer on per retailer in the
 * admin without touching this file.
 */
export const RETAILERS: SeedRetailer[] = [
  // ---- GB ----
  { label: 'Tesco', slug: 'tesco', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.tesco.com/groceries/en-GB/search?query={query}', priority: 50 },
  { label: 'Sainsbury’s', slug: 'sainsburys', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.sainsburys.co.uk/gol-ui/SearchResults/{query}', priority: 40 },
  { label: 'Asda', slug: 'asda', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://groceries.asda.com/search/{query}', priority: 30 },
  { label: 'Ocado', slug: 'ocado', type: 'delivery', countries: ['GB'], searchUrlTemplate: 'https://www.ocado.com/search?entry={query}', priority: 20 },
  { label: 'Amazon Fresh', slug: 'amazon-fresh-uk', type: 'marketplace', countries: ['GB'], searchUrlTemplate: 'https://www.amazon.co.uk/s?k={query}&i=amazonfresh', priority: 10 },
  // ---- US ----
  { label: 'Walmart', slug: 'walmart', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.walmart.com/search?q={query}', priority: 50 },
  { label: 'Target', slug: 'target', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.target.com/s?searchTerm={query}', priority: 40 },
  { label: 'Kroger', slug: 'kroger', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.kroger.com/search?query={query}', priority: 30 },
  { label: 'Amazon Fresh', slug: 'amazon-fresh-us', type: 'marketplace', countries: ['US'], searchUrlTemplate: 'https://www.amazon.com/s?k={query}&i=amazonfresh', priority: 10 },
  // ---- CA ----
  { label: 'Walmart Canada', slug: 'walmart-ca', type: 'supermarket', countries: ['CA'], searchUrlTemplate: 'https://www.walmart.ca/search?q={query}', priority: 50 },
  { label: 'Voilà', slug: 'voila-ca', type: 'delivery', countries: ['CA'], searchUrlTemplate: 'https://voila.ca/products/search?q={query}', priority: 30 },
  { label: 'Amazon Canada', slug: 'amazon-ca', type: 'marketplace', countries: ['CA'], searchUrlTemplate: 'https://www.amazon.ca/s?k={query}', priority: 10 },
  // ---- IE ----
  { label: 'Tesco Ireland', slug: 'tesco-ie', type: 'supermarket', countries: ['IE'], searchUrlTemplate: 'https://www.tesco.ie/groceries/en-IE/search?query={query}', priority: 50 },
  { label: 'SuperValu', slug: 'supervalu-ie', type: 'supermarket', countries: ['IE'], searchUrlTemplate: 'https://shop.supervalu.ie/shopping/search?q={query}', priority: 40 },
  // ---- AU ----
  { label: 'Woolworths', slug: 'woolworths-au', type: 'supermarket', countries: ['AU'], searchUrlTemplate: 'https://www.woolworths.com.au/shop/search/products?searchTerm={query}', priority: 50 },
  { label: 'Coles', slug: 'coles-au', type: 'supermarket', countries: ['AU'], searchUrlTemplate: 'https://www.coles.com.au/search/products?q={query}', priority: 40 },
  { label: 'Amazon Australia', slug: 'amazon-au', type: 'marketplace', countries: ['AU'], searchUrlTemplate: 'https://www.amazon.com.au/s?k={query}', priority: 10 },
  // ---- NZ ----
  { label: 'Woolworths NZ', slug: 'woolworths-nz', type: 'supermarket', countries: ['NZ'], searchUrlTemplate: 'https://www.woolworths.co.nz/shop/searchproducts?search={query}', priority: 50 },
  // ---- IN ----
  { label: 'BigBasket', slug: 'bigbasket', type: 'delivery', countries: ['IN'], searchUrlTemplate: 'https://www.bigbasket.com/ps/?q={query}', priority: 50 },
  { label: 'Blinkit', slug: 'blinkit', type: 'delivery', countries: ['IN'], searchUrlTemplate: 'https://blinkit.com/s/?q={query}', priority: 40 },
  { label: 'JioMart', slug: 'jiomart', type: 'marketplace', countries: ['IN'], searchUrlTemplate: 'https://www.jiomart.com/search/{query}', priority: 30 },
  { label: 'Zepto', slug: 'zepto', type: 'delivery', countries: ['IN'], searchUrlTemplate: 'https://www.zeptonow.com/search?query={query}', priority: 20 },
  { label: 'Amazon India', slug: 'amazon-in', type: 'marketplace', countries: ['IN'], searchUrlTemplate: 'https://www.amazon.in/s?k={query}', priority: 10 },
  // ---- DE ----
  { label: 'REWE', slug: 'rewe', type: 'supermarket', countries: ['DE'], searchUrlTemplate: 'https://shop.rewe.de/productList?search={query}', priority: 50 },
  { label: 'Amazon Deutschland', slug: 'amazon-de', type: 'marketplace', countries: ['DE'], searchUrlTemplate: 'https://www.amazon.de/s?k={query}', priority: 10 },
  // ---- FR ----
  { label: 'Carrefour', slug: 'carrefour-fr', type: 'supermarket', countries: ['FR'], searchUrlTemplate: 'https://www.carrefour.fr/s?q={query}', priority: 50 },
  { label: 'Auchan', slug: 'auchan-fr', type: 'supermarket', countries: ['FR'], searchUrlTemplate: 'https://www.auchan.fr/recherche?text={query}', priority: 40 },
  { label: 'Amazon France', slug: 'amazon-fr', type: 'marketplace', countries: ['FR'], searchUrlTemplate: 'https://www.amazon.fr/s?k={query}', priority: 10 },
  // ---- ES ----
  { label: 'Carrefour España', slug: 'carrefour-es', type: 'supermarket', countries: ['ES'], searchUrlTemplate: 'https://www.carrefour.es/?q={query}', priority: 50 },
  { label: 'DIA', slug: 'dia-es', type: 'supermarket', countries: ['ES'], searchUrlTemplate: 'https://www.dia.es/search?q={query}', priority: 40 },
  { label: 'Mercadona', slug: 'mercadona', type: 'supermarket', countries: ['ES'], searchUrlTemplate: 'https://tienda.mercadona.es/search-results?query={query}', priority: 30 },
  // ---- IT ----
  { label: 'Carrefour Italia', slug: 'carrefour-it', type: 'supermarket', countries: ['IT'], searchUrlTemplate: 'https://www.carrefour.it/search?q={query}', priority: 40 },
  { label: 'Amazon Italia', slug: 'amazon-it', type: 'marketplace', countries: ['IT'], searchUrlTemplate: 'https://www.amazon.it/s?k={query}', priority: 10 },
  // ---- NL ----
  { label: 'Albert Heijn', slug: 'albert-heijn', type: 'supermarket', countries: ['NL'], searchUrlTemplate: 'https://www.ah.nl/zoeken?query={query}', priority: 50 },
  { label: 'Jumbo', slug: 'jumbo-nl', type: 'supermarket', countries: ['NL'], searchUrlTemplate: 'https://www.jumbo.com/producten?searchType=keyword&searchTerms={query}', priority: 40 },
  // ---- BE ----
  { label: 'Carrefour Belgique', slug: 'carrefour-be', type: 'supermarket', countries: ['BE'], searchUrlTemplate: 'https://www.carrefour.be/nl/search?q={query}', priority: 40 },
  // ---- CH ----
  { label: 'Migros', slug: 'migros-ch', type: 'supermarket', countries: ['CH'], searchUrlTemplate: 'https://www.migros.ch/en/search?query={query}', priority: 50 },
  { label: 'Coop', slug: 'coop-ch', type: 'supermarket', countries: ['CH'], searchUrlTemplate: 'https://www.coop.ch/en/search/?text={query}', priority: 40 },
  // ---- AT ----
  { label: 'BILLA', slug: 'billa-at', type: 'supermarket', countries: ['AT'], searchUrlTemplate: 'https://shop.billa.at/search?searchTerm={query}', priority: 40 },
  // ---- PT ----
  { label: 'Continente', slug: 'continente-pt', type: 'supermarket', countries: ['PT'], searchUrlTemplate: 'https://www.continente.pt/pesquisa/?q={query}', priority: 50 },
  // ---- SE ----
  { label: 'ICA', slug: 'ica-se', type: 'supermarket', countries: ['SE'], searchUrlTemplate: 'https://www.ica.se/handla/sok/?q={query}', priority: 50 },
  { label: 'Coop Sverige', slug: 'coop-se', type: 'supermarket', countries: ['SE'], searchUrlTemplate: 'https://www.coop.se/handla/varor/?text={query}', priority: 40 },
  // ---- NO ----
  { label: 'Oda', slug: 'oda-no', type: 'delivery', countries: ['NO'], searchUrlTemplate: 'https://oda.com/no/search/?q={query}', priority: 40 },
  // ---- FI ----
  { label: 'S-kaupat', slug: 's-kaupat-fi', type: 'supermarket', countries: ['FI'], searchUrlTemplate: 'https://www.s-kaupat.fi/hakutulokset?queryString={query}', priority: 40 },
  { label: 'K-Ruoka', slug: 'k-ruoka-fi', type: 'supermarket', countries: ['FI'], searchUrlTemplate: 'https://www.k-ruoka.fi/haku?q={query}', priority: 30 },
  // ---- JP ----
  { label: 'Amazon Japan', slug: 'amazon-jp', type: 'marketplace', countries: ['JP'], searchUrlTemplate: 'https://www.amazon.co.jp/s?k={query}', priority: 30 },
  { label: 'Rakuten Seiyu', slug: 'rakuten-seiyu', type: 'delivery', countries: ['JP'], searchUrlTemplate: 'https://sm.rakuten.co.jp/search?keyword={query}', priority: 20 },
  // ---- KR ----
  { label: 'Coupang', slug: 'coupang', type: 'marketplace', countries: ['KR'], searchUrlTemplate: 'https://www.coupang.com/np/search?q={query}', priority: 50 },
  { label: 'SSG', slug: 'ssg-kr', type: 'marketplace', countries: ['KR'], searchUrlTemplate: 'https://www.ssg.com/search.ssg?query={query}', priority: 40 },
  // ---- SG ----
  { label: 'FairPrice', slug: 'fairprice-sg', type: 'supermarket', countries: ['SG'], searchUrlTemplate: 'https://www.fairprice.com.sg/search?query={query}', priority: 50 },
  { label: 'Amazon Singapore', slug: 'amazon-sg', type: 'marketplace', countries: ['SG'], searchUrlTemplate: 'https://www.amazon.sg/s?k={query}', priority: 10 },
  // ---- HK ----
  { label: 'PARKnSHOP', slug: 'parknshop-hk', type: 'supermarket', countries: ['HK'], searchUrlTemplate: 'https://www.pns.hk/en/search?q={query}', priority: 40 },
  // ---- AE ----
  { label: 'Carrefour UAE', slug: 'carrefour-ae', type: 'supermarket', countries: ['AE'], searchUrlTemplate: 'https://www.carrefouruae.com/mafuae/en/v4/search?keyword={query}', priority: 50 },
  { label: 'Amazon UAE', slug: 'amazon-ae', type: 'marketplace', countries: ['AE'], searchUrlTemplate: 'https://www.amazon.ae/s?k={query}', priority: 10 },
  // ---- SA ----
  { label: 'Carrefour KSA', slug: 'carrefour-sa', type: 'supermarket', countries: ['SA'], searchUrlTemplate: 'https://www.carrefourksa.com/mafsau/en/v4/search?keyword={query}', priority: 40 },
  // ---- TR ----
  { label: 'Migros Türkiye', slug: 'migros-tr', type: 'supermarket', countries: ['TR'], searchUrlTemplate: 'https://www.migros.com.tr/arama?q={query}', priority: 40 },
  // ---- BR ----
  { label: 'Carrefour Brasil', slug: 'carrefour-br', type: 'supermarket', countries: ['BR'], searchUrlTemplate: 'https://mercado.carrefour.com.br/s?q={query}', priority: 50 },
  { label: 'Pão de Açúcar', slug: 'pao-de-acucar', type: 'supermarket', countries: ['BR'], searchUrlTemplate: 'https://www.paodeacucar.com/busca?terms={query}', priority: 40 },
  // ---- MX ----
  { label: 'Walmart México', slug: 'walmart-mx', type: 'supermarket', countries: ['MX'], searchUrlTemplate: 'https://super.walmart.com.mx/search?q={query}', priority: 50 },
  { label: 'Soriana', slug: 'soriana-mx', type: 'supermarket', countries: ['MX'], searchUrlTemplate: 'https://www.soriana.com/buscar?q={query}', priority: 40 },
  // ---- AR ----
  { label: 'Carrefour Argentina', slug: 'carrefour-ar', type: 'supermarket', countries: ['AR'], searchUrlTemplate: 'https://www.carrefour.com.ar/s?q={query}', priority: 40 },
  // ---- CL ----
  { label: 'Jumbo Chile', slug: 'jumbo-cl', type: 'supermarket', countries: ['CL'], searchUrlTemplate: 'https://www.jumbo.cl/busqueda?ft={query}', priority: 40 },
  // ---- CO ----
  { label: 'Éxito', slug: 'exito-co', type: 'supermarket', countries: ['CO'], searchUrlTemplate: 'https://www.exito.com/s?q={query}', priority: 40 },
  // ---- ZA ----
  { label: 'Checkers', slug: 'checkers-za', type: 'supermarket', countries: ['ZA'], searchUrlTemplate: 'https://www.checkers.co.za/search?q={query}', priority: 50 },
  { label: 'Pick n Pay', slug: 'pnp-za', type: 'supermarket', countries: ['ZA'], searchUrlTemplate: 'https://www.pnp.co.za/search/{query}', priority: 40 },
  { label: 'Woolworths SA', slug: 'woolworths-za', type: 'supermarket', countries: ['ZA'], searchUrlTemplate: 'https://www.woolworths.co.za/cat?Ntt={query}', priority: 30 },
  // ---- NG ----
  { label: 'Jumia', slug: 'jumia-ng', type: 'marketplace', countries: ['NG'], searchUrlTemplate: 'https://www.jumia.com.ng/catalog/?q={query}', priority: 40 },
  // ---- KE ----
  { label: 'Carrefour Kenya', slug: 'carrefour-ke', type: 'supermarket', countries: ['KE'], searchUrlTemplate: 'https://www.carrefour.ke/mafken/en/v4/search?keyword={query}', priority: 40 },
  // ---- EG ----
  { label: 'Carrefour Egypt', slug: 'carrefour-eg', type: 'supermarket', countries: ['EG'], searchUrlTemplate: 'https://www.carrefouregypt.com/mafegy/en/v4/search?keyword={query}', priority: 40 },
  // ---- BD ----
  { label: 'Chaldal', slug: 'chaldal-bd', type: 'delivery', countries: ['BD'], searchUrlTemplate: 'https://chaldal.com/search?q={query}', priority: 40 },
  // ---- Majors added after the first pass; graded by verify:grocery ----
  { label: 'Morrisons', slug: 'morrisons', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://groceries.morrisons.com/search?entry={query}', priority: 35 },
  { label: 'Waitrose', slug: 'waitrose', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.waitrose.com/ecom/shop/search?&searchTerm={query}', priority: 25 },
  { label: 'Co-op', slug: 'coop-gb', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.coop.co.uk/products/search?q={query}', priority: 15 },
  { label: 'Iceland', slug: 'iceland-gb', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.iceland.co.uk/search?q={query}', priority: 12 },
  { label: 'Lidl', slug: 'lidl-gb', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.lidl.co.uk/q/search?q={query}', priority: 22 },
  { label: 'Aldi', slug: 'aldi-gb', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://groceries.aldi.co.uk/en-GB/Search?keywords={query}', priority: 23 },
  { label: 'Instacart', slug: 'instacart-us', type: 'delivery', countries: ['US'], searchUrlTemplate: 'https://www.instacart.com/store/s?k={query}', priority: 45 },
  { label: 'Costco', slug: 'costco-us', type: 'marketplace', countries: ['US'], searchUrlTemplate: 'https://www.costco.com/CatalogSearch?keyword={query}', priority: 28 },
  { label: 'Publix', slug: 'publix-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.publix.com/search?q={query}', priority: 26 },
  { label: 'Safeway', slug: 'safeway-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.safeway.com/shop/search-results.html?q={query}', priority: 24 },
  { label: 'H-E-B', slug: 'heb-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.heb.com/search?q={query}', priority: 18 },
  { label: 'Loblaws', slug: 'loblaws-ca', type: 'supermarket', countries: ['CA'], searchUrlTemplate: 'https://www.loblaws.ca/search?search-bar={query}', priority: 45 },
  { label: 'Metro', slug: 'metro-ca', type: 'supermarket', countries: ['CA'], searchUrlTemplate: 'https://www.metro.ca/en/online-grocery/search?filter={query}', priority: 40 },
  { label: 'No Frills', slug: 'nofrills-ca', type: 'supermarket', countries: ['CA'], searchUrlTemplate: 'https://www.nofrills.ca/search?search-bar={query}', priority: 35 },
  { label: 'Aldi Deutschland', slug: 'aldi-de', type: 'supermarket', countries: ['DE'], searchUrlTemplate: 'https://www.aldi-sued.de/de/suche.html?query={query}', priority: 45 },
  { label: 'Lidl Deutschland', slug: 'lidl-de', type: 'supermarket', countries: ['DE'], searchUrlTemplate: 'https://www.lidl.de/q/search?q={query}', priority: 44 },
  { label: 'Kaufland', slug: 'kaufland-de', type: 'supermarket', countries: ['DE'], searchUrlTemplate: 'https://www.kaufland.de/s/?search_value={query}', priority: 42 },
  { label: 'E.Leclerc', slug: 'leclerc-fr', type: 'supermarket', countries: ['FR'], searchUrlTemplate: 'https://www.e.leclerc/recherche?q={query}', priority: 45 },
  { label: 'Intermarché', slug: 'intermarche-fr', type: 'supermarket', countries: ['FR'], searchUrlTemplate: 'https://www.intermarche.com/recherche/{query}', priority: 35 },
  { label: 'Monoprix', slug: 'monoprix-fr', type: 'supermarket', countries: ['FR'], searchUrlTemplate: 'https://www.monoprix.fr/recherche?q={query}', priority: 25 },
  { label: 'Esselunga', slug: 'esselunga-it', type: 'supermarket', countries: ['IT'], searchUrlTemplate: 'https://www.esselunga.it/it-it/ricerca.html?query={query}', priority: 50 },
  { label: 'Conad', slug: 'conad-it', type: 'supermarket', countries: ['IT'], searchUrlTemplate: 'https://spesaonline.conad.it/search?q={query}', priority: 45 },
  { label: 'Lidl España', slug: 'lidl-es', type: 'supermarket', countries: ['ES'], searchUrlTemplate: 'https://www.lidl.es/q/search?q={query}', priority: 25 },
  { label: 'Dunnes Stores', slug: 'dunnes-ie', type: 'supermarket', countries: ['IE'], searchUrlTemplate: 'https://www.dunnesstoresgrocery.com/sm/delivery/rsid/258/results?q={query}', priority: 35 },
  { label: 'Aldi Australia', slug: 'aldi-au', type: 'supermarket', countries: ['AU'], searchUrlTemplate: 'https://www.aldi.com.au/results/?q={query}', priority: 30 },
  { label: 'IGA', slug: 'iga-au', type: 'supermarket', countries: ['AU'], searchUrlTemplate: 'https://www.igashop.com.au/search?q={query}', priority: 25 },
  { label: 'Pak’nSave', slug: 'paknsave-nz', type: 'supermarket', countries: ['NZ'], searchUrlTemplate: 'https://www.paknsave.co.nz/shop/search?q={query}', priority: 45 },
  { label: 'New World', slug: 'newworld-nz', type: 'supermarket', countries: ['NZ'], searchUrlTemplate: 'https://www.newworld.co.nz/shop/search?q={query}', priority: 40 },
  { label: 'DMart Ready', slug: 'dmart-in', type: 'supermarket', countries: ['IN'], searchUrlTemplate: 'https://www.dmart.in/search?searchTerm={query}', priority: 35 },
  { label: 'Swiggy Instamart', slug: 'instamart-in', type: 'delivery', countries: ['IN'], searchUrlTemplate: 'https://www.swiggy.com/instamart/search?custom_back=true&query={query}', priority: 38 },
  { label: 'Emart', slug: 'emart-kr', type: 'supermarket', countries: ['KR'], searchUrlTemplate: 'https://emart.ssg.com/search.ssg?target=all&query={query}', priority: 35 },
  { label: 'Cold Storage', slug: 'cold-storage-sg', type: 'supermarket', countries: ['SG'], searchUrlTemplate: 'https://coldstorage.com.sg/search?q={query}', priority: 40 },
  { label: 'Lulu Hypermarket', slug: 'lulu-ae', type: 'supermarket', countries: ['AE'], searchUrlTemplate: 'https://www.luluhypermarket.com/en-ae/search?q={query}', priority: 40 },
  { label: 'Shoprite', slug: 'shoprite-za', type: 'supermarket', countries: ['ZA'], searchUrlTemplate: 'https://www.shoprite.co.za/search?q={query}', priority: 45 },
  { label: 'Woolworths Online', slug: 'woolies-food-za', type: 'delivery', countries: ['ZA'], searchUrlTemplate: 'https://www.woolworths.co.za/cat/Food/_/N-1z13sk5?Ntt={query}', priority: 28 },
  { label: 'Assaí', slug: 'assai-br', type: 'supermarket', countries: ['BR'], searchUrlTemplate: 'https://www.assai.com.br/busca?q={query}', priority: 35 },
  { label: 'Chedraui', slug: 'chedraui-mx', type: 'supermarket', countries: ['MX'], searchUrlTemplate: 'https://www.chedraui.com.mx/{query}?_q={query}&map=ft', priority: 35 },
  { label: 'Lider', slug: 'lider-cl', type: 'supermarket', countries: ['CL'], searchUrlTemplate: 'https://www.lider.cl/search?query={query}', priority: 45 },
  { label: 'Coto', slug: 'coto-ar', type: 'supermarket', countries: ['AR'], searchUrlTemplate: 'https://www.cotodigital.com.ar/sitios/cdigi/browse?Ntt={query}', priority: 35 },
  // ---- Batch 3: new countries + depth. Every row graded by verify:grocery
  //      before seeding; fails get fixed or dropped, never shipped. ----
  // US depth
  { label: 'Albertsons', slug: 'albertsons-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.albertsons.com/shop/search-results.html?q={query}', priority: 23 },
  { label: 'Wegmans', slug: 'wegmans-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.wegmans.com/shop/search?search-term={query}', priority: 21 },
  { label: 'Meijer', slug: 'meijer-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.meijer.com/shopping/search.html?text={query}', priority: 19 },
  { label: 'Sprouts', slug: 'sprouts-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://shop.sprouts.com/search?search_term={query}', priority: 17 },
  { label: 'Food Lion', slug: 'foodlion-us', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://shop.foodlion.com/search?search_term={query}', priority: 16 },
  // CA depth
  { label: 'Real Canadian Superstore', slug: 'superstore-ca', type: 'supermarket', countries: ['CA'], searchUrlTemplate: 'https://www.realcanadiansuperstore.ca/search?search-bar={query}', priority: 42 },
  { label: 'Save-On-Foods', slug: 'saveonfoods-ca', type: 'supermarket', countries: ['CA'], searchUrlTemplate: 'https://www.saveonfoods.com/sm/pickup/rsid/1982/results?q={query}', priority: 25 },
  // FR / ES / DE / AT / SE / NO depth
  { label: 'Picard', slug: 'picard-fr', type: 'supermarket', countries: ['FR'], searchUrlTemplate: 'https://www.picard.fr/recherche?q={query}', priority: 20 },
  { label: 'Alcampo', slug: 'alcampo-es', type: 'supermarket', countries: ['ES'], searchUrlTemplate: 'https://www.compraonline.alcampo.es/search?entry={query}', priority: 35 },
  { label: 'Eroski', slug: 'eroski-es', type: 'supermarket', countries: ['ES'], searchUrlTemplate: 'https://supermercado.eroski.es/es/search/results/?q={query}', priority: 20 },
  { label: 'Knuspr', slug: 'knuspr-de', type: 'delivery', countries: ['DE'], searchUrlTemplate: 'https://www.knuspr.de/suche?q={query}', priority: 30 },
  { label: 'INTERSPAR', slug: 'interspar-at', type: 'supermarket', countries: ['AT'], searchUrlTemplate: 'https://www.interspar.at/shop/lebensmittel/search/?q={query}', priority: 35 },
  { label: 'Mathem', slug: 'mathem-se', type: 'delivery', countries: ['SE'], searchUrlTemplate: 'https://www.mathem.se/se/search?q={query}', priority: 30 },
  { label: 'Meny', slug: 'meny-no', type: 'supermarket', countries: ['NO'], searchUrlTemplate: 'https://meny.no/sok/?query={query}', priority: 35 },
  // AU depth
  { label: 'Harris Farm', slug: 'harrisfarm-au', type: 'supermarket', countries: ['AU'], searchUrlTemplate: 'https://www.harrisfarm.com.au/search?q={query}', priority: 15 },
  // BR depth
  { label: 'Extra', slug: 'extra-br', type: 'supermarket', countries: ['BR'], searchUrlTemplate: 'https://www.clubeextra.com.br/busca?terms={query}', priority: 30 },
  // Poland (retry with different shops)
  { label: 'Auchan Polska', slug: 'auchan-pl', type: 'supermarket', countries: ['PL'], searchUrlTemplate: 'https://zakupy.auchan.pl/search?text={query}', priority: 40 },
  { label: 'Carrefour Polska', slug: 'carrefour-pl', type: 'supermarket', countries: ['PL'], searchUrlTemplate: 'https://www.carrefour.pl/szukaj?q={query}', priority: 35 },
  // Denmark (retry)
  { label: 'Bilka ToGo', slug: 'bilka-dk', type: 'supermarket', countries: ['DK'], searchUrlTemplate: 'https://www.bilkatogo.dk/search/{query}', priority: 40 },
  { label: 'REMA 1000', slug: 'rema-dk', type: 'supermarket', countries: ['DK'], searchUrlTemplate: 'https://shop.rema1000.dk/varer/sog?q={query}', priority: 35 },
  // Malaysia (retry)
  { label: 'Jaya Grocer', slug: 'jaya-my', type: 'supermarket', countries: ['MY'], searchUrlTemplate: 'https://www.jayagrocer.com/search?q={query}', priority: 40 },
  // Thailand
  { label: 'Big C', slug: 'bigc-th', type: 'supermarket', countries: ['TH'], searchUrlTemplate: 'https://www.bigc.co.th/en/search?q={query}', priority: 40 },
  { label: 'Tops', slug: 'tops-th', type: 'supermarket', countries: ['TH'], searchUrlTemplate: 'https://www.tops.co.th/en/search/{query}', priority: 35 },
  // Indonesia
  { label: 'Klik Indomaret', slug: 'klikindomaret-id', type: 'supermarket', countries: ['ID'], searchUrlTemplate: 'https://www.klikindomaret.com/search/?key={query}', priority: 40 },
  { label: 'Alfagift', slug: 'alfagift-id', type: 'supermarket', countries: ['ID'], searchUrlTemplate: 'https://alfagift.id/search?q={query}', priority: 35 },
  // Vietnam / Philippines
  { label: 'Bách hoá XANH', slug: 'bhx-vn', type: 'supermarket', countries: ['VN'], searchUrlTemplate: 'https://www.bachhoaxanh.com/tim-kiem?key={query}', priority: 40 },
  { label: 'SM Markets', slug: 'smmarkets-ph', type: 'supermarket', countries: ['PH'], searchUrlTemplate: 'https://smmarkets.ph/catalogsearch/result/?q={query}', priority: 35 },
  // Pakistan / Sri Lanka
  { label: 'Carrefour Pakistan', slug: 'carrefour-pk', type: 'supermarket', countries: ['PK'], searchUrlTemplate: 'https://www.carrefourpakistan.com/mafpak/en/v4/search?keyword={query}', priority: 40 },
  { label: 'Naheed', slug: 'naheed-pk', type: 'supermarket', countries: ['PK'], searchUrlTemplate: 'https://www.naheed.pk/catalogsearch/result?q={query}', priority: 35 },
  { label: 'Keells', slug: 'keells-lk', type: 'supermarket', countries: ['LK'], searchUrlTemplate: 'https://www.keellssuper.com/search?query={query}', priority: 40 },
  // Greece / Czechia / Slovakia / Hungary / Romania / Bulgaria / Croatia / Serbia / Ukraine / Baltics
  { label: 'AB Vassilopoulos', slug: 'ab-gr', type: 'supermarket', countries: ['GR'], searchUrlTemplate: 'https://www.ab.gr/search?q={query}', priority: 40 },
  { label: 'Rohlík', slug: 'rohlik-cz', type: 'delivery', countries: ['CZ'], searchUrlTemplate: 'https://www.rohlik.cz/hledat?q={query}', priority: 40 },
  { label: 'Košík', slug: 'kosik-cz', type: 'delivery', countries: ['CZ'], searchUrlTemplate: 'https://www.kosik.cz/vyhledavani?q={query}', priority: 35 },
  { label: 'Tesco Slovensko', slug: 'tesco-sk', type: 'supermarket', countries: ['SK'], searchUrlTemplate: 'https://potravinydomov.itesco.sk/groceries/sk-SK/search?query={query}', priority: 40 },
  { label: 'Tesco Magyarország', slug: 'tesco-hu', type: 'supermarket', countries: ['HU'], searchUrlTemplate: 'https://bevasarlas.tesco.hu/groceries/hu-HU/search?query={query}', priority: 40 },
  { label: 'Mega Image', slug: 'mega-image-ro', type: 'supermarket', countries: ['RO'], searchUrlTemplate: 'https://www.mega-image.ro/search?q={query}', priority: 40 },
  { label: 'eBag', slug: 'ebag-bg', type: 'delivery', countries: ['BG'], searchUrlTemplate: 'https://www.ebag.bg/search/?q={query}', priority: 40 },
  { label: 'Konzum', slug: 'konzum-hr', type: 'supermarket', countries: ['HR'], searchUrlTemplate: 'https://www.konzum.hr/web/search?q={query}', priority: 40 },
  { label: 'Maxi', slug: 'maxi-rs', type: 'supermarket', countries: ['RS'], searchUrlTemplate: 'https://www.maxi.rs/search?q={query}', priority: 40 },
  { label: 'Silpo', slug: 'silpo-ua', type: 'supermarket', countries: ['UA'], searchUrlTemplate: 'https://silpo.ua/search?find={query}', priority: 40 },
  { label: 'Barbora', slug: 'barbora-lt', type: 'delivery', countries: ['LT'], searchUrlTemplate: 'https://www.barbora.lt/paieska?q={query}', priority: 40 },
  { label: 'Barbora Latvija', slug: 'barbora-lv', type: 'delivery', countries: ['LV'], searchUrlTemplate: 'https://www.barbora.lv/meklet?q={query}', priority: 40 },
  { label: 'Barbora Eesti', slug: 'barbora-ee', type: 'delivery', countries: ['EE'], searchUrlTemplate: 'https://www.barbora.ee/otsing?q={query}', priority: 40 },
  // Israel / Gulf
  { label: 'Shufersal', slug: 'shufersal-il', type: 'supermarket', countries: ['IL'], searchUrlTemplate: 'https://www.shufersal.co.il/online/he/search?text={query}', priority: 40 },
  { label: 'Carrefour Qatar', slug: 'carrefour-qa', type: 'supermarket', countries: ['QA'], searchUrlTemplate: 'https://www.carrefourqatar.com/mafqat/en/v4/search?keyword={query}', priority: 40 },
  // South America depth
  { label: 'PlazaVea', slug: 'plazavea-pe', type: 'supermarket', countries: ['PE'], searchUrlTemplate: 'https://www.plazavea.com.pe/{query}?map=ft', priority: 40 },
  { label: 'Tienda Inglesa', slug: 'tienda-inglesa-uy', type: 'supermarket', countries: ['UY'], searchUrlTemplate: 'https://www.tiendainglesa.com.uy/busqueda?q={query}', priority: 40 },
  // ---- Batch 4: toward the 208. MAF's Carrefour domains share one URL
  //      pattern, which unlocks much of MENA, the Caucasus and East Africa in
  //      one verified sweep; the rest are each market's real leader. ----
  // Taiwan / SE Asia / Central Asia
  { label: 'Carrefour Taiwan', slug: 'carrefour-tw', type: 'supermarket', countries: ['TW'], searchUrlTemplate: 'https://online.carrefour.com.tw/en/search?q={query}', priority: 40 },
  { label: 'PChome 24h', slug: 'pchome-tw', type: 'marketplace', countries: ['TW'], searchUrlTemplate: 'https://24h.pchome.com.tw/search/?q={query}', priority: 25 },
  { label: 'Arbuz', slug: 'arbuz-kz', type: 'delivery', countries: ['KZ'], searchUrlTemplate: 'https://arbuz.kz/en/search?q={query}', priority: 40 },
  { label: 'Airba Fresh', slug: 'airba-kz', type: 'delivery', countries: ['KZ'], searchUrlTemplate: 'https://airba.kz/search?query={query}', priority: 30 },
  // Europe leftovers
  { label: 'Cactus', slug: 'cactus-lu', type: 'supermarket', countries: ['LU'], searchUrlTemplate: 'https://www.cactus.lu/en/search?q={query}', priority: 40 },
  { label: 'Alphamega', slug: 'alphamega-cy', type: 'supermarket', countries: ['CY'], searchUrlTemplate: 'https://www.alphamega.com.cy/search?q={query}', priority: 40 },
  { label: 'E-dostavka', slug: 'edostavka-by', type: 'delivery', countries: ['BY'], searchUrlTemplate: 'https://edostavka.by/search?query={query}', priority: 40 },
  // Africa
  { label: 'Marjane Mall', slug: 'marjane-ma', type: 'supermarket', countries: ['MA'], searchUrlTemplate: 'https://www.marjanemall.ma/catalogsearch/result/?q={query}', priority: 40 },
  // Latin America / Caribbean
  { label: 'Auto Mercado', slug: 'automercado-cr', type: 'supermarket', countries: ['CR'], searchUrlTemplate: 'https://automercado.cr/buscar?q={query}', priority: 40 },
  { label: 'Sirena', slug: 'sirena-do', type: 'supermarket', countries: ['DO'], searchUrlTemplate: 'https://sirena.do/search?q={query}', priority: 40 },
  { label: 'Massy Stores', slug: 'massy-tt', type: 'supermarket', countries: ['TT'], searchUrlTemplate: 'https://www.massystorestt.com/search?q={query}', priority: 40 },
  { label: 'Superdelicias', slug: 'superdelicias-py', type: 'supermarket', countries: ['PY'], searchUrlTemplate: 'https://www.superseis.com.py/buscar?q={query}', priority: 35 },
  { label: 'Plaza Lama', slug: 'plazalama-do', type: 'supermarket', countries: ['DO'], searchUrlTemplate: 'https://plazalama.com.do/search?q={query}', priority: 30 },
  { label: 'Farmatodo Venezuela', slug: 'farmatodo-ve', type: 'supermarket', countries: ['VE'], searchUrlTemplate: 'https://www.farmatodo.com.ve/buscar?product={query}', priority: 25 },
]
