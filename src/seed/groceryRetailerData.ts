/*
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
]
