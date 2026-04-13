const API_URL = "/api/convert";
const SAMPLE_LINKS = [
  "https://music.apple.com/br/album/who-will-you-follow/1891104460?i=1891104594",
  "https://music.apple.com/br/album/swim/1868862375?i=1868862384",
  "https://music.apple.com/br/album/choka-choka/1891400123?i=1891400226",
  "https://music.apple.com/br/album/life-boat/1871085677?i=1871085701",
  "https://music.apple.com/br/album/space/1884652117?i=1884652125",
  "https://music.apple.com/br/album/zombie/1874720357?i=1874720787",
  "https://music.apple.com/br/album/orange-county-feat-bizarrap-kara-jackson-anoushka-shankar/1837237742?i=1837237867",
  "https://music.apple.com/br/album/i-could-have-sworn/1852602431?i=1852602432",
  "https://music.apple.com/br/album/pink-lemonade/1852384560?i=1852384561",
  "https://music.apple.com/br/album/pixelated-kisses/1849706656?i=1849706661",
  "https://music.apple.com/br/album/aperture/1870984032?i=1870984033",
  "https://music.apple.com/br/album/american-girls/1870984032?i=1870984036",
  "https://music.apple.com/br/album/ready-steady-go/1870984032?i=1870984038",
  "https://music.apple.com/br/album/carlas-song/1870984032?i=1870984054",
  "https://music.apple.com/br/album/canzone-estiva/1882460107?i=1882460109",
  "https://music.apple.com/br/album/let-me-go-first/1862926375?i=1862926628",
  "https://music.apple.com/br/album/golden/1820264137?i=1820264150"
];
const HERO_LOGO_GIF_URL = "https://i.imgur.com/T1uEx9T.gif?v=20260411";

const REQUESTED_ADAPTERS = [
  "appleMusic",
  "spotify",
  "youTube",
  "deezer",
  "soundCloud",
  "pandora",
  "qobuz",
  "bandcamp",
  "tidal"
];

const STREAMING_HOST_HINTS = [
  "music.apple.com",
  "open.spotify.com",
  "spotify.link",
  "youtube.com",
  "youtu.be",
  "music.youtube.com",
  "deezer.com",
  "soundcloud.com",
  "tidal.com",
  "pandora.com",
  "qobuz.com",
  "bandcamp.com",
  "music.amazon.com",
  "amazon.com/music"
];
const RECENT_SWAPS_STORAGE_KEY = "mls-recent-swaps";
const LANGUAGE_STORAGE_KEY = "mls-language";
const MAX_RECENT_SWAPS = 5;
const LANGUAGE_OPTIONS = [
  { label: "PT-BR", value: "pt-br", fullName: "português-brasil" },
  { label: "EN", value: "en", fullName: "english" },
  { label: "ES", value: "es-es", fullName: "español" },
  { label: "IT", value: "it-it", fullName: "italiano" },
  { label: "FR", value: "fr-fr", fullName: "français" }
];
const TRANSLATIONS = {
  "pt-br": {
    loadingSwap: "swapando...",
    loadingSearch: "pesquisando...",
    swap: "swap",
    search: "pesquisar",
    linkLabel: "link da música",
    searchLabel: "pesquisa por nome",
    linkPlaceholder: "cole o link da música aqui",
    searchPlaceholder: "digite o nome do artista + música",
    byline: "por leo saquetto",
    subtitle: "qualquer streaming por um só link",
    availableAs: "Disponível como",
    madeBy: "feito por 🇧🇷",
    languageSelected: "português-brasil selecionado.",
    themeLight: "modo claro",
    themeDark: "modo escuro",
    activateDark: "ativar modo escuro",
    activateLight: "ativar modo claro",
    recentSwaps: "swaps recentes",
    latestSwap: "último swap",
    clearSwap: "limpar swap",
    clearSwaps: "limpar swaps",
    noRecentSwaps: "ainda não há swaps recentes.",
    seeMore: "ver mais",
    seeLess: "ver menos",
    primarySection: "principais",
    othersSection: "outras",
    verified: "verificado",
    identified: "identificado",
    notLocated: "não localizado",
    linkCopied: "link copiado.",
    swapsFoundSingle: "1 swap encontrado!",
    swapsFoundPlural: "{count} swaps encontrados!",
    topCopied: "principais copiadas.",
    topShared: "principais compartilhadas.",
    originalCopied: "link original copiado.",
    copiedSuffix: "copiado.",
    sharedSuffix: "compartilhado.",
    privacyPolicy: "política de privacidade",
    termsOfUse: "termos de uso"
  },
  en: {
    loadingSwap: "swapping...",
    loadingSearch: "searching...",
    swap: "swap",
    search: "search",
    linkLabel: "song link",
    searchLabel: "search by name",
    linkPlaceholder: "paste the song link here",
    searchPlaceholder: "type artist + song name",
    byline: "by leo saquetto",
    subtitle: "any streaming into one link",
    availableAs: "Available as",
    madeBy: "made by 🇧🇷",
    languageSelected: "english selected.",
    themeLight: "light mode",
    themeDark: "dark mode",
    activateDark: "enable dark mode",
    activateLight: "enable light mode",
    recentSwaps: "recent swaps",
    latestSwap: "latest swap",
    clearSwap: "clear swap",
    clearSwaps: "clear swaps",
    noRecentSwaps: "there are no recent swaps yet.",
    seeMore: "see more",
    seeLess: "see less",
    primarySection: "main",
    othersSection: "others",
    verified: "verified",
    identified: "identified",
    notLocated: "not found",
    linkCopied: "link copied.",
    swapsFoundSingle: "1 swap found!",
    swapsFoundPlural: "{count} swaps found!",
    topCopied: "main links copied.",
    topShared: "main links shared.",
    originalCopied: "original link copied.",
    copiedSuffix: "copied.",
    sharedSuffix: "shared.",
    privacyPolicy: "privacy policy",
    termsOfUse: "terms of use"
  },
  "es-es": {
    loadingSwap: "convirtiendo...",
    loadingSearch: "buscando...",
    swap: "swap",
    search: "buscar",
    linkLabel: "enlace de la canción",
    searchLabel: "búsqueda por nombre",
    linkPlaceholder: "pega aquí el enlace de la canción",
    searchPlaceholder: "escribe artista + canción",
    byline: "por leo saquetto",
    subtitle: "cualquier streaming en un solo enlace",
    availableAs: "Disponible como",
    madeBy: "hecho por 🇧🇷",
    languageSelected: "español seleccionado.",
    themeLight: "modo claro",
    themeDark: "modo oscuro",
    activateDark: "activar modo oscuro",
    activateLight: "activar modo claro",
    recentSwaps: "swaps recientes",
    latestSwap: "último swap",
    clearSwap: "limpiar swap",
    clearSwaps: "limpiar swaps",
    noRecentSwaps: "aún no hay swaps recientes.",
    seeMore: "ver más",
    seeLess: "ver menos",
    primarySection: "principales",
    othersSection: "otros",
    verified: "verificado",
    identified: "identificado",
    notLocated: "no encontrado",
    linkCopied: "enlace copiado.",
    swapsFoundSingle: "¡1 swap encontrado!",
    swapsFoundPlural: "¡{count} swaps encontrados!",
    topCopied: "principales copiadas.",
    topShared: "principales compartidas.",
    originalCopied: "enlace original copiado.",
    copiedSuffix: "copiado.",
    sharedSuffix: "compartido.",
    privacyPolicy: "política de privacidad",
    termsOfUse: "términos de uso"
  },
  "it-it": {
    loadingSwap: "conversione...",
    loadingSearch: "ricerca...",
    swap: "swap",
    search: "cerca",
    linkLabel: "link della canzone",
    searchLabel: "ricerca per nome",
    linkPlaceholder: "incolla qui il link della canzone",
    searchPlaceholder: "digita artista + canzone",
    byline: "di leo saquetto",
    subtitle: "qualsiasi streaming in un solo link",
    availableAs: "Disponibile come",
    madeBy: "fatto da 🇧🇷",
    languageSelected: "italiano selezionato.",
    themeLight: "tema chiaro",
    themeDark: "tema scuro",
    activateDark: "attiva tema scuro",
    activateLight: "attiva tema chiaro",
    recentSwaps: "swap recenti",
    latestSwap: "ultimo swap",
    clearSwap: "cancella swap",
    clearSwaps: "cancella swaps",
    noRecentSwaps: "non ci sono ancora swap recenti.",
    seeMore: "vedi altro",
    seeLess: "vedi meno",
    primarySection: "principali",
    othersSection: "altri",
    verified: "verificato",
    identified: "identificato",
    notLocated: "non trovato",
    linkCopied: "link copiato.",
    swapsFoundSingle: "1 swap trovato!",
    swapsFoundPlural: "{count} swaps trovati!",
    topCopied: "principali copiate.",
    topShared: "principali condivise.",
    originalCopied: "link originale copiato.",
    copiedSuffix: "copiato.",
    sharedSuffix: "condiviso.",
    privacyPolicy: "informativa sulla privacy",
    termsOfUse: "termini di utilizzo"
  },
  "fr-fr": {
    loadingSwap: "conversion...",
    loadingSearch: "recherche...",
    swap: "swap",
    search: "rechercher",
    linkLabel: "lien de la chanson",
    searchLabel: "recherche par nom",
    linkPlaceholder: "collez le lien de la chanson ici",
    searchPlaceholder: "tapez artiste + chanson",
    byline: "par leo saquetto",
    subtitle: "n’importe quel streaming en un seul lien",
    availableAs: "Disponible en",
    madeBy: "fait par 🇧🇷",
    languageSelected: "français sélectionné.",
    themeLight: "mode clair",
    themeDark: "mode sombre",
    activateDark: "activer le mode sombre",
    activateLight: "activer le mode clair",
    recentSwaps: "swaps récents",
    latestSwap: "dernier swap",
    clearSwap: "effacer le swap",
    clearSwaps: "effacer les swaps",
    noRecentSwaps: "il n’y a pas encore de swaps récents.",
    seeMore: "voir plus",
    seeLess: "voir moins",
    primarySection: "principaux",
    othersSection: "autres",
    verified: "vérifié",
    identified: "identifié",
    notLocated: "non trouvé",
    linkCopied: "lien copié.",
    swapsFoundSingle: "1 swap trouvé !",
    swapsFoundPlural: "{count} swaps trouvés !",
    topCopied: "principaux copiés.",
    topShared: "principaux partagés.",
    originalCopied: "lien original copié.",
    copiedSuffix: "copié.",
    sharedSuffix: "partagé.",
    privacyPolicy: "politique de confidentialité",
    termsOfUse: "conditions d’utilisation"
  }
};

const LEGAL_CONTENT = {
  "pt-br": {
    privacyTitle: "política de privacidade",
    termsTitle: "termos de uso",
    privacyHtml: `<p><strong>última atualização:</strong> abril de 2026</p><p>este serviço permite converter links de música entre diferentes plataformas de streaming.</p><ol><li><strong>informações processadas</strong><p>quando você utiliza este serviço, links enviados por você podem ser processados para gerar resultados de conversão entre plataformas. dependendo da funcionalidade utilizada, o serviço também pode armazenar preferências locais no seu navegador, como tema, idioma e histórico recente.</p></li><li><strong>armazenamento local</strong><p>este serviço pode usar recursos locais do navegador, como localstorage, para salvar preferências e melhorar a experiência de uso. essas informações ficam armazenadas no seu próprio dispositivo e navegador.</p></li><li><strong>serviços de terceiros</strong><p>para funcionar, este serviço pode depender de provedores, apis e plataformas de terceiros. ao utilizar este serviço, algumas informações técnicas e os links enviados podem ser encaminhados a esses serviços estritamente para viabilizar a conversão e a exibição dos resultados.</p></li><li><strong>dados pessoais</strong><p>este serviço não foi projetado para solicitar cadastro ou coletar mais dados pessoais do que o necessário para seu funcionamento básico. ainda assim, dados técnicos como endereço ip, navegador, dispositivo, logs e informações de acesso podem ser processados pela infraestrutura de hospedagem e por serviços de terceiros.</p></li><li><strong>uso dos dados</strong><p>as informações processadas são utilizadas para:</p><ul><li>executar a conversão de links</li><li>manter o funcionamento, segurança e estabilidade do serviço</li><li>salvar preferências locais e melhorar a experiência do usuário</li><li>prevenir abuso, uso automatizado indevido e falhas técnicas</li></ul></li><li><strong>retenção</strong><p>preferências salvas localmente permanecem no seu navegador até serem removidas por você ou pelo próprio navegador. logs e dados técnicos podem ser mantidos temporariamente pela infraestrutura e por serviços de terceiros, conforme suas próprias políticas.</p></li><li><strong>links externos</strong><p>os resultados podem conter links para serviços e plataformas externas. este serviço não controla o conteúdo, políticas ou práticas dessas plataformas.</p></li><li><strong>alterações</strong><p>esta política pode ser atualizada a qualquer momento para refletir mudanças no serviço, na infraestrutura ou em integrações de terceiros.</p></li><li><strong>contato</strong><p>caso você tenha dúvidas sobre esta política, utilize o canal de contato disponibilizado neste site, quando houver.</p></li></ol>`,
    termsHtml: `<p><strong>última atualização:</strong> abril de 2026</p><p>ao acessar e utilizar este serviço, você concorda com os termos abaixo.</p><ol><li><strong>objeto do serviço</strong><p>este serviço disponibiliza uma ferramenta para conversão e descoberta de links de música entre plataformas de streaming.</p></li><li><strong>uso permitido</strong><p>você concorda em utilizar este serviço apenas para fins legítimos e de forma compatível com a lei e com estes termos.</p></li><li><strong>uso indevido</strong><p>não é permitido:</p><ul><li>utilizar o serviço de maneira abusiva, automatizada ou que possa comprometer sua estabilidade</li><li>tentar contornar medidas de segurança, limitação de acesso ou proteção contra abuso</li><li>utilizar o serviço para atividades ilícitas ou que violem direitos de terceiros</li></ul></li><li><strong>disponibilidade</strong><p>o serviço pode ser alterado, suspenso, limitado ou interrompido a qualquer momento, com ou sem aviso prévio.</p></li><li><strong>resultados e terceiros</strong><p>os resultados dependem de provedores, plataformas e serviços de terceiros. por isso, disponibilidade, precisão, compatibilidade e funcionamento podem variar sem garantia.</p></li><li><strong>ausência de garantias</strong><p>este serviço é fornecido no estado em que se encontra, sem garantias de disponibilidade contínua, precisão absoluta ou adequação a um propósito específico.</p></li><li><strong>responsabilidade</strong><p>na máxima extensão permitida pela lei aplicável, o operador deste serviço não será responsável por perdas, danos, indisponibilidades, falhas de terceiros ou prejuízos decorrentes do uso ou da impossibilidade de uso do serviço.</p></li><li><strong>links externos</strong><p>este serviço pode exibir links para plataformas e serviços externos. o acesso a esses ambientes ocorre por conta e risco do usuário.</p></li><li><strong>alterações nos termos</strong><p>estes termos podem ser modificados a qualquer momento. o uso continuado do serviço após alterações representa aceitação da versão atualizada.</p></li><li><strong>disposição final</strong><p>caso alguma disposição destes termos seja considerada inválida ou inaplicável, as demais permanecerão em pleno vigor.</p></li></ol>`
  },
  en: {
    privacyTitle: "privacy policy",
    termsTitle: "terms of use",
    privacyHtml: `<p><strong>last updated:</strong> april 2026</p><p>this service allows users to convert music links across different streaming platforms.</p><ol><li><strong>information processed</strong><p>when you use this service, links submitted by you may be processed in order to generate conversion results across platforms. depending on the feature used, the service may also store local preferences in your browser, such as theme, language, and recent history.</p></li><li><strong>local storage</strong><p>this service may use local browser storage, such as localstorage, to save preferences and improve the user experience. this information remains stored on your own device and browser.</p></li><li><strong>third-party services</strong><p>to operate, this service may rely on third-party providers, apis, and platforms. by using this service, certain technical information and submitted links may be sent to such services strictly for link conversion and result delivery.</p></li><li><strong>personal data</strong><p>this service is not designed to require account registration or intentionally collect more personal data than necessary for basic operation. however, technical data such as ip address, browser, device, logs, and access information may be processed by the hosting infrastructure and third-party services.</p></li><li><strong>use of information</strong><p>processed information may be used to:</p><ul><li>perform link conversion</li><li>maintain service functionality, security, and stability</li><li>save local preferences and improve user experience</li><li>prevent abuse, improper automated use, and technical failures</li></ul></li><li><strong>retention</strong><p>preferences stored locally remain in your browser until removed by you or by the browser itself. logs and technical data may be temporarily retained by the infrastructure and third-party services according to their own policies.</p></li><li><strong>external links</strong><p>results may contain links to external services and platforms. this service does not control the content, policies, or practices of those platforms.</p></li><li><strong>changes</strong><p>this policy may be updated at any time to reflect changes to the service, infrastructure, or third-party integrations.</p></li><li><strong>contact</strong><p>if you have questions about this policy, please use the contact channel made available on this site, if any.</p></li></ol>`,
    termsHtml: `<p><strong>last updated:</strong> april 2026</p><p>by accessing and using this service, you agree to the terms below.</p><ol><li><strong>service purpose</strong><p>this service provides a tool for music link conversion and discovery across streaming platforms.</p></li><li><strong>permitted use</strong><p>you agree to use this service only for lawful purposes and in a manner consistent with these terms.</p></li><li><strong>prohibited use</strong><p>you may not:</p><ul><li>use the service in an abusive or automated manner that may harm its stability</li><li>attempt to bypass security measures, access limits, or abuse protections</li><li>use the service for unlawful activities or in ways that violate third-party rights</li></ul></li><li><strong>availability</strong><p>the service may be changed, suspended, limited, or discontinued at any time, with or without prior notice.</p></li><li><strong>results and third parties</strong><p>results depend on third-party providers, platforms, and services. therefore, availability, accuracy, compatibility, and operation may vary without guarantee.</p></li><li><strong>disclaimer of warranties</strong><p>this service is provided on an “as is” basis, without warranties of continuous availability, absolute accuracy, or fitness for a particular purpose.</p></li><li><strong>liability</strong><p>to the maximum extent permitted by applicable law, the operator of this service shall not be liable for losses, damages, unavailability, third-party failures, or any harm arising from the use or inability to use the service.</p></li><li><strong>external links</strong><p>this service may display links to external platforms and services. access to such environments is at the user’s own risk.</p></li><li><strong>changes to these terms</strong><p>these terms may be modified at any time. continued use of the service after changes means acceptance of the updated version.</p></li><li><strong>final provision</strong><p>if any provision of these terms is found invalid or unenforceable, the remaining provisions shall remain in full force and effect.</p></li></ol>`
  },
  "es-es": {
    privacyTitle: "política de privacidad",
    termsTitle: "términos de uso",
    privacyHtml: `<p><strong>última actualización:</strong> abril de 2026</p><p>este servicio permite convertir enlaces de música entre diferentes plataformas de streaming.</p><ol><li><strong>información procesada</strong><p>cuando utilizas este servicio, los enlaces enviados por ti pueden ser procesados para generar resultados de conversión entre plataformas. según la funcionalidad utilizada, el servicio también puede almacenar preferencias locales en tu navegador, como tema, idioma e historial reciente.</p></li><li><strong>almacenamiento local</strong><p>este servicio puede usar recursos locales del navegador, como localstorage, para guardar preferencias y mejorar la experiencia de uso. esta información permanece almacenada en tu propio dispositivo y navegador.</p></li><li><strong>servicios de terceros</strong><p>para funcionar, este servicio puede depender de proveedores, apis y plataformas de terceros. al usar este servicio, cierta información técnica y los enlaces enviados pueden ser compartidos con dichos servicios estrictamente para viabilizar la conversión y mostrar los resultados.</p></li><li><strong>datos personales</strong><p>este servicio no fue diseñado para requerir registro ni para recopilar más datos personales de los necesarios para su funcionamiento básico. aun así, datos técnicos como dirección ip, navegador, dispositivo, registros e información de acceso pueden ser procesados por la infraestructura de alojamiento y por servicios de terceros.</p></li><li><strong>uso de los datos</strong><p>la información procesada se utiliza para:</p><ul><li>realizar la conversión de enlaces</li><li>mantener el funcionamiento, la seguridad y la estabilidad del servicio</li><li>guardar preferencias locales y mejorar la experiencia del usuario</li><li>prevenir abuso, uso automatizado indebido y fallas técnicas</li></ul></li><li><strong>retención</strong><p>las preferencias guardadas localmente permanecen en tu navegador hasta que tú o el propio navegador las eliminen. los registros y datos técnicos pueden conservarse temporalmente por la infraestructura y por servicios de terceros según sus propias políticas.</p></li><li><strong>enlaces externos</strong><p>los resultados pueden contener enlaces a servicios y plataformas externas. este servicio no controla el contenido, las políticas ni las prácticas de esas plataformas.</p></li><li><strong>cambios</strong><p>esta política puede actualizarse en cualquier momento para reflejar cambios en el servicio, la infraestructura o integraciones de terceros.</p></li><li><strong>contacto</strong><p>si tienes dudas sobre esta política, utiliza el canal de contacto disponible en este sitio, cuando exista.</p></li></ol>`,
    termsHtml: `<p><strong>última actualización:</strong> abril de 2026</p><p>al acceder y utilizar este servicio, aceptas los términos siguientes.</p><ol><li><strong>objeto del servicio</strong><p>este servicio ofrece una herramienta para conversión y descubrimiento de enlaces de música entre plataformas de streaming.</p></li><li><strong>uso permitido</strong><p>aceptas utilizar este servicio solo para fines legítimos y de forma compatible con la ley y con estos términos.</p></li><li><strong>uso indebido</strong><p>no está permitido:</p><ul><li>utilizar el servicio de forma abusiva, automatizada o que pueda comprometer su estabilidad</li><li>intentar eludir medidas de seguridad, limitación de acceso o protección contra abuso</li><li>utilizar el servicio para actividades ilícitas o que violen derechos de terceros</li></ul></li><li><strong>disponibilidad</strong><p>el servicio puede ser modificado, suspendido, limitado o interrumpido en cualquier momento, con o sin aviso previo.</p></li><li><strong>resultados y terceros</strong><p>los resultados dependen de proveedores, plataformas y servicios de terceros. por ello, disponibilidad, precisión, compatibilidad y funcionamiento pueden variar sin garantía.</p></li><li><strong>ausencia de garantías</strong><p>este servicio se proporciona “tal como está”, sin garantías de disponibilidad continua, precisión absoluta o adecuación para un propósito específico.</p></li><li><strong>responsabilidad</strong><p>en la máxima medida permitida por la ley aplicable, el operador de este servicio no será responsable por pérdidas, daños, indisponibilidad, fallas de terceros o perjuicios derivados del uso o de la imposibilidad de uso del servicio.</p></li><li><strong>enlaces externos</strong><p>este servicio puede mostrar enlaces a plataformas y servicios externos. el acceso a esos entornos ocurre por cuenta y riesgo del usuario.</p></li><li><strong>cambios en los términos</strong><p>estos términos pueden modificarse en cualquier momento. el uso continuado del servicio tras los cambios implica aceptación de la versión actualizada.</p></li><li><strong>disposición final</strong><p>si alguna disposición de estos términos se considera inválida o inaplicable, las demás permanecerán en pleno vigor y efecto.</p></li></ol>`
  },
  "it-it": {
    privacyTitle: "informativa sulla privacy",
    termsTitle: "termini di utilizzo",
    privacyHtml: `<p><strong>ultimo aggiornamento:</strong> aprile 2026</p><p>questo servizio permette di convertire link musicali tra diverse piattaforme di streaming.</p><ol><li><strong>informazioni trattate</strong><p>quando utilizzi questo servizio, i link inviati da te possono essere trattati per generare risultati di conversione tra piattaforme. in base alla funzionalità utilizzata, il servizio può anche salvare preferenze locali nel browser, come tema, lingua e cronologia recente.</p></li><li><strong>archiviazione locale</strong><p>questo servizio può usare risorse locali del browser, come localstorage, per salvare preferenze e migliorare l’esperienza d’uso. queste informazioni restano memorizzate nel tuo dispositivo e nel tuo browser.</p></li><li><strong>servizi di terze parti</strong><p>per funzionare, questo servizio può dipendere da provider, api e piattaforme di terze parti. usando questo servizio, alcune informazioni tecniche e i link inviati possono essere inoltrati a tali servizi esclusivamente per rendere possibile la conversione e la visualizzazione dei risultati.</p></li><li><strong>dati personali</strong><p>questo servizio non è progettato per richiedere registrazione o raccogliere più dati personali del necessario per il funzionamento di base. tuttavia, dati tecnici come indirizzo ip, browser, dispositivo, log e informazioni di accesso possono essere trattati dall’infrastruttura di hosting e da servizi di terze parti.</p></li><li><strong>uso dei dati</strong><p>le informazioni trattate sono utilizzate per:</p><ul><li>eseguire la conversione dei link</li><li>mantenere funzionamento, sicurezza e stabilità del servizio</li><li>salvare preferenze locali e migliorare l’esperienza utente</li><li>prevenire abusi, uso automatizzato improprio e guasti tecnici</li></ul></li><li><strong>conservazione</strong><p>le preferenze salvate localmente restano nel browser finché non vengono rimosse da te o dal browser stesso. log e dati tecnici possono essere conservati temporaneamente dall’infrastruttura e da servizi di terze parti secondo le rispettive policy.</p></li><li><strong>link esterni</strong><p>i risultati possono contenere link a servizi e piattaforme esterne. questo servizio non controlla contenuti, policy o pratiche di tali piattaforme.</p></li><li><strong>modifiche</strong><p>questa informativa può essere aggiornata in qualsiasi momento per riflettere cambiamenti nel servizio, nell’infrastruttura o nelle integrazioni di terze parti.</p></li><li><strong>contatto</strong><p>se hai dubbi su questa informativa, utilizza il canale di contatto disponibile su questo sito, quando presente.</p></li></ol>`,
    termsHtml: `<p><strong>ultimo aggiornamento:</strong> aprile 2026</p><p>accedendo e utilizzando questo servizio, accetti i termini riportati di seguito.</p><ol><li><strong>oggetto del servizio</strong><p>questo servizio mette a disposizione uno strumento per conversione e scoperta di link musicali tra piattaforme di streaming.</p></li><li><strong>uso consentito</strong><p>accetti di utilizzare questo servizio solo per finalità legittime e in modo conforme alla legge e a questi termini.</p></li><li><strong>uso improprio</strong><p>non è consentito:</p><ul><li>utilizzare il servizio in modo abusivo, automatizzato o tale da comprometterne la stabilità</li><li>tentare di aggirare misure di sicurezza, limiti di accesso o protezioni contro gli abusi</li><li>utilizzare il servizio per attività illecite o che violino diritti di terzi</li></ul></li><li><strong>disponibilità</strong><p>il servizio può essere modificato, sospeso, limitato o interrotto in qualsiasi momento, con o senza preavviso.</p></li><li><strong>risultati e terze parti</strong><p>i risultati dipendono da provider, piattaforme e servizi di terze parti. pertanto, disponibilità, precisione, compatibilità e funzionamento possono variare senza garanzia.</p></li><li><strong>assenza di garanzie</strong><p>questo servizio è fornito “così com’è”, senza garanzie di disponibilità continua, precisione assoluta o idoneità a uno scopo specifico.</p></li><li><strong>responsabilità</strong><p>nella massima misura consentita dalla legge applicabile, l’operatore di questo servizio non sarà responsabile per perdite, danni, indisponibilità, guasti di terzi o pregiudizi derivanti dall’uso o dall’impossibilità di usare il servizio.</p></li><li><strong>link esterni</strong><p>questo servizio può mostrare link a piattaforme e servizi esterni. l’accesso a tali ambienti avviene a rischio dell’utente.</p></li><li><strong>modifiche ai termini</strong><p>questi termini possono essere modificati in qualsiasi momento. l’uso continuato del servizio dopo le modifiche rappresenta accettazione della versione aggiornata.</p></li><li><strong>disposizione finale</strong><p>se una disposizione di questi termini è ritenuta invalida o inapplicabile, le restanti disposizioni resteranno pienamente valide ed efficaci.</p></li></ol>`
  },
  "fr-fr": {
    privacyTitle: "politique de confidentialité",
    termsTitle: "conditions d’utilisation",
    privacyHtml: `<p><strong>dernière mise à jour :</strong> avril 2026</p><p>ce service permet de convertir des liens musicaux entre différentes plateformes de streaming.</p><ol><li><strong>informations traitées</strong><p>lorsque vous utilisez ce service, les liens envoyés par vous peuvent être traités afin de générer des résultats de conversion entre plateformes. selon la fonctionnalité utilisée, le service peut également stocker des préférences locales dans votre navigateur, comme le thème, la langue et l’historique récent.</p></li><li><strong>stockage local</strong><p>ce service peut utiliser des ressources locales du navigateur, comme localstorage, pour enregistrer des préférences et améliorer l’expérience d’utilisation. ces informations restent stockées sur votre propre appareil et navigateur.</p></li><li><strong>services tiers</strong><p>pour fonctionner, ce service peut dépendre de fournisseurs, d’apis et de plateformes tiers. en utilisant ce service, certaines informations techniques et les liens envoyés peuvent être transmis à ces services strictement pour permettre la conversion et l’affichage des résultats.</p></li><li><strong>données personnelles</strong><p>ce service n’est pas conçu pour exiger une inscription ni collecter plus de données personnelles que nécessaire à son fonctionnement de base. cependant, des données techniques telles que l’adresse ip, le navigateur, l’appareil, les journaux et les informations d’accès peuvent être traitées par l’infrastructure d’hébergement et par des services tiers.</p></li><li><strong>utilisation des données</strong><p>les informations traitées sont utilisées pour :</p><ul><li>effectuer la conversion de liens</li><li>maintenir le fonctionnement, la sécurité et la stabilité du service</li><li>enregistrer des préférences locales et améliorer l’expérience utilisateur</li><li>prévenir les abus, l’utilisation automatisée abusive et les défaillances techniques</li></ul></li><li><strong>conservation</strong><p>les préférences enregistrées localement restent dans votre navigateur jusqu’à leur suppression par vous ou par le navigateur lui-même. les journaux et données techniques peuvent être conservés temporairement par l’infrastructure et par des services tiers, conformément à leurs propres politiques.</p></li><li><strong>liens externes</strong><p>les résultats peuvent contenir des liens vers des services et plateformes externes. ce service ne contrôle pas le contenu, les politiques ni les pratiques de ces plateformes.</p></li><li><strong>modifications</strong><p>cette politique peut être mise à jour à tout moment pour refléter les changements du service, de l’infrastructure ou des intégrations tierces.</p></li><li><strong>contact</strong><p>si vous avez des questions sur cette politique, utilisez le canal de contact mis à disposition sur ce site, le cas échéant.</p></li></ol>`,
    termsHtml: `<p><strong>dernière mise à jour :</strong> avril 2026</p><p>en accédant à ce service et en l’utilisant, vous acceptez les conditions ci-dessous.</p><ol><li><strong>objet du service</strong><p>ce service propose un outil de conversion et de découverte de liens musicaux entre plateformes de streaming.</p></li><li><strong>utilisation autorisée</strong><p>vous acceptez d’utiliser ce service uniquement à des fins légitimes et conformément à la loi et aux présentes conditions.</p></li><li><strong>utilisation abusive</strong><p>il est interdit de :</p><ul><li>utiliser le service de manière abusive, automatisée ou susceptible de compromettre sa stabilité</li><li>tenter de contourner les mesures de sécurité, les limites d’accès ou les protections contre les abus</li><li>utiliser le service pour des activités illicites ou violant les droits de tiers</li></ul></li><li><strong>disponibilité</strong><p>le service peut être modifié, suspendu, limité ou interrompu à tout moment, avec ou sans préavis.</p></li><li><strong>résultats et tiers</strong><p>les résultats dépendent de fournisseurs, plateformes et services tiers. par conséquent, la disponibilité, la précision, la compatibilité et le fonctionnement peuvent varier sans garantie.</p></li><li><strong>absence de garanties</strong><p>ce service est fourni “tel quel”, sans garanties de disponibilité continue, de précision absolue ou d’adéquation à un objectif spécifique.</p></li><li><strong>responsabilité</strong><p>dans la limite maximale autorisée par la loi applicable, l’opérateur de ce service ne sera pas responsable des pertes, dommages, indisponibilités, défaillances de tiers ou préjudices découlant de l’utilisation ou de l’impossibilité d’utiliser le service.</p></li><li><strong>liens externes</strong><p>ce service peut afficher des liens vers des plateformes et services externes. l’accès à ces environnements se fait aux risques de l’utilisateur.</p></li><li><strong>modifications des conditions</strong><p>ces conditions peuvent être modifiées à tout moment. l’utilisation continue du service après les modifications vaut acceptation de la version mise à jour.</p></li><li><strong>disposition finale</strong><p>si une disposition de ces conditions est jugée invalide ou inapplicable, les autres dispositions resteront pleinement en vigueur.</p></li></ol>`
  }
};

const IGNORED_PLATFORM_KEYS = new Set(["audius", "audios", "boomplay", "napster", "yandex", "anghami"]);

const SVG_ICONS = {
  history: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 20 20" aria-hidden="true"><path fill="currentColor" d="M9.47 14.53a1 1 0 0 1 0-1.41l4.24-4.24a1 1 0 0 1 1.41 1.41l-4.24 4.24a1 1 0 0 1-1.41 0Zm-3.54 3.54a4 4 0 0 1 0-5.66l2.12-2.12a1 1 0 1 1 1.41 1.41L7.34 13.8a2 2 0 0 0 2.83 2.83l2.12-2.12a1 1 0 0 1 1.41 1.41l-2.12 2.12a4 4 0 0 1-5.66 0ZM10.3 8.7a1 1 0 0 1 0-1.4l2.12-2.13a4 4 0 0 1 5.66 5.66l-2.12 2.12a1 1 0 1 1-1.41-1.41l2.12-2.12a2 2 0 0 0-2.83-2.83L11.71 8.7a1 1 0 0 1-1.41 0Z"/></svg>`,
  shuffle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3,8H5.28a6,6,0,0,1,4.51,2.05L13.21,14a6,6,0,0,0,4.51,2H21"/><polyline points="19 14 21 16 19 18"/><path d="M21,8H17.72a6,6,0,0,0-4.51,2.05L9.79,14a6,6,0,0,1-4.51,2H3"/><polyline points="19 6 21 8 19 10"/></g></svg>`,
  swap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410.489 410.489" aria-hidden="true"><path fill="currentColor" d="M370.446,256.623l36.079-81.654c2.257-5.125,3.328-10.356,3.356-15.262c1.167-5.059,0.708-10.519-1.854-15.482c-3.356-6.55-9.477-10.643-16.209-11.876c-2.696-1.252-5.604-2.247-8.759-2.897l-87.459-17.939c-16.715-3.452-32.397,4.102-35.008,16.839c-2.611,12.747,8.807,25.848,25.531,29.261l33.211,6.837L186.99,232.726c-11.15,5.709-15.51,19.422-9.773,30.553c5.767,11.131,19.44,15.481,30.561,9.744l134.631-69.396l-15.022,34.004c-6.885,15.616-2.84,32.513,9.056,37.782C348.338,280.654,363.562,272.239,370.446,256.623z"/><path fill="currentColor" d="M74.067,135.093c-11.905-5.26-27.129,3.146-34.023,18.762l-36.08,81.654c-2.256,5.125-3.328,10.355-3.356,15.28c-1.167,5.049-0.708,10.5,1.855,15.463c3.366,6.55,9.476,10.643,16.208,11.877c2.696,1.252,5.613,2.247,8.769,2.897l87.458,17.958c16.706,3.433,32.388-4.121,34.999-16.858c2.61-12.729-8.807-25.848-25.532-29.262l-33.211-6.827l132.344-68.267c11.15-5.728,15.521-19.44,9.773-30.571c-5.767-11.131-19.431-15.482-30.561-9.744L68.081,206.87l15.023-34.014C90.007,157.259,85.972,140.343,74.067,135.093z"/></svg>`,
  telegram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M256 0C114.62 0 0 114.62 0 256s114.62 256 256 256s256-114.62 256-256S397.38 0 256 0Zm118.77 174.93l-41.37 195.03c-3.12 13.86-11.28 17.28-22.84 10.77l-63.11-46.52l-30.44 29.3c-3.37 3.37-6.19 6.19-12.68 6.19l4.54-64.33l117.12-105.84c5.09-4.54-1.12-7.09-7.87-2.55L173.4 288.22l-62.29-19.46c-13.56-4.25-13.86-13.56 2.82-20.08l243.5-93.85c11.28-4.25 21.14 2.55 17.34 20.1Z"/></svg>`,
  paste: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M7.5 6h1.67A3.001 3.001 0 0 0 12 8h6a3.001 3.001 0 0 0 2.83-2h1.67A1.5 1.5 0 0 1 24 7.5a1 1 0 1 0 2 0A3.5 3.5 0 0 0 22.5 4h-1.67A3.001 3.001 0 0 0 18 2h-6a3.001 3.001 0 0 0-2.83 2H7.5A3.5 3.5 0 0 0 4 7.5v19A3.5 3.5 0 0 0 7.5 30H12a1 1 0 1 0 0-2H7.5A1.5 1.5 0 0 1 6 26.5v-19A1.5 1.5 0 0 1 7.5 6ZM12 4h6a1 1 0 1 1 0 2h-6a1 1 0 1 1 0-2Zm5.5 6a3.5 3.5 0 0 0-3.5 3.5v13a3.5 3.5 0 0 0 3.5 3.5h8a3.5 3.5 0 0 0 3.5-3.5v-13a3.5 3.5 0 0 0-3.5-3.5h-8ZM16 13.5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5v-13Z"/></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M18.202 2.182a.5.5 0 0 1 .707.707l-5.322 5.323a4.5 4.5 0 0 1-.335 5.99l-.663.664l-2.09 3.483a.5.5 0 0 1-.782.096l-5.095-5.094c.04-.07.078-.143.106-.22l.007-.024l.246-.757l.015-.04l4.975 4.975l1.592-2.651l-4.695-4.695q-.024-.053-.054-.105l-.054-.085l-.062-.08a1.3 1.3 0 0 0-.568-.396l-.045-.015l-.024-.006l-.706-.229l.87-.521l.664-.663a4.5 4.5 0 0 1 5.99-.335zm-5.657 6.364a3.5 3.5 0 0 0-4.95 0l-.353.353l4.95 4.95l.353-.354a3.5 3.5 0 0 0 0-4.95M3.485 8a.3.3 0 0 1 .285.201l.249.766a1.58 1.58 0 0 0 .999.998l.183.06l.278.09l.304.098l.015.004a.3.3 0 0 1 .202.285a.3.3 0 0 1-.202.285l-.765.248a1.58 1.58 0 0 0-.999.998l-.249.766a.302.302 0 0 1-.57 0l-.25-.766a1.58 1.58 0 0 0-.998-1.002l-.765-.248A.3.3 0 0 1 1 10.498a.3.3 0 0 1 .202-.285l.765-.248a1.58 1.58 0 0 0 .984-.998L3.2 8.2a.3.3 0 0 1 .284-.2m1.994-8a.42.42 0 0 1 .399.282l.348 1.072A2.2 2.2 0 0 0 7.624 2.75l1.072.349l.022.005a.423.423 0 0 1 0 .797l-1.072.349a2.2 2.2 0 0 0-1.399 1.396L5.9 6.718a.423.423 0 0 1-.643.204l-.02-.015a.43.43 0 0 1-.135-.19l-.348-1.07a2.2 2.2 0 0 0-1.398-1.402l-1.073-.349a.423.423 0 0 1 0-.797l1.072-.349a2.21 2.21 0 0 0 1.377-1.396L5.08.282A.42.42 0 0 1 5.48 0"/></svg>`,
  clearLegacy: `<svg id="Camada_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true"><g id="TL7sri.tif"><path fill="currentColor" d="M313.6,151.5c6.2,2.5,12.9,3.5,18.1,8.2l169.8,169.7c9.6,10.7,11.7,23.9,3,36.1-5,7-39.5,41.5-46.5,46.6-11.6,8.3-23.9-3.5-17.9-14.9,4.6-6.8,46.9-44.7,46.3-48l-171.9-172.2-2.8-1.3-116.7,116.3,175.1,174.9c2.7,0,31-34.6,38.2-36.8,12.1-3.8,21.4,6.8,14.5,17.4l-130.8,130.6c-8.1,6.4-17,4.1-26.3,3.7l-40.6,41.3h551c4.6-.3,6.1,4.2,9.7,6v10.5c-3.5,5.3-9.5,7.3-15.7,7.6-201,.9-401.7-1.8-602.7-1.7-10.4-2.4-19.9-7.2-28-14.1-32.8-37.2-76.5-70.6-108.2-108.1-45.3-53.4,15.8-91.4,48.9-127-1.1-10.4-1.7-17.8,4.5-26.9,72.6-71.5,143-146,217.5-215.2l10.1-2.6h1.5ZM177.5,309.2l-29.3,29.3,175.1,174.9,29.3-29.3-175.1-174.9ZM130.9,355.7c-3.7,4.9-27.9,25.5-27.9,29.3l.8,2.2,169.8,169.8,3.1,1.5c3.8,0,24.3-24.1,29.3-27.8l-175.1-174.9ZM96.4,414.3l-53.4,54.7c-5.3,10.2-5,20.1-.3,30.4l116.8,117.6c9.4,5.9,20.1,7.4,30.4,3.3,8.4-3.3,48.7-42.7,55.3-51.3.9-1.1,2.4-1.8,2.1-3.6l-151-151.1Z"/></g></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M18.327 7.286h-8.044a1.932 1.932 0 0 0-1.925 1.938v10.088c0 1.07.862 1.938 1.925 1.938h8.044a1.932 1.932 0 0 0 1.925-1.938V9.224c0-1.07-.862-1.938-1.925-1.938"/><path d="M15.642 7.286V4.688c0-.514-.203-1.007-.564-1.37a1.918 1.918 0 0 0-1.361-.568H5.673c-.51 0-1 .204-1.36.568a1.945 1.945 0 0 0-.565 1.37v10.088c0 .514.203 1.007.564 1.37c.361.364.85.568 1.361.568h2.685"/></g></svg>`,
  open: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M7 17L17 7m0 0H9m8 0v8"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true"><path d="M561.6,511.7c-66.3,66.3-170.3,76.5-248.3,24.4-78-52.1-108.3-152.1-72.4-238.7,35.9-86.7,128-135.9,220-117.6,92,18.3,158.2,99.1,158.2,192.9,0,52.1-20.7,102.1-57.6,139Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="72px"/><path d="M171.2,624l112.4-112.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="72px"/></svg>`,
  share: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M12 16V4m0 0l-4 4m4-4l4 4"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M5 13.5v3.25A2.25 2.25 0 0 0 7.25 19h9.5A2.25 2.25 0 0 0 19 16.75V13.5"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.08 2.56a1 1 0 0 1 1.27 1.22a8.03 8.03 0 0 0 9.87 9.87a1 1 0 0 1 1.22 1.27A10 10 0 1 1 9.08 2.56Z"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3"/></g></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" aria-hidden="true"><g fill="currentColor"><path d="M74.66,26C90.48,26,102,37.52,102,53.34V74.66C102,90.48,90.48,102,74.66,102H53.34C37.52,102,26,90.48,26,74.66V53.34a27.39,27.39,0,0,1,7.73-19.58A27.39,27.39,0,0,1,53.34,26H74.66m0-10H53.34C32,16,16,32,16,53.34V74.66C16,96,32,112,53.34,112H74.66C96,112,112,96,112,74.66V53.34C112,32,96,16,74.66,16Z"/><rect x="20.83" y="59" width="86.34" height="10"/><path d="M64,26a8.2,8.2,0,0,1,5.5,1.61,14.31,14.31,0,0,1,3.94,6.07C75.91,40.07,77.12,50,77.12,64s-1.21,23.93-3.68,30.29a14.31,14.31,0,0,1-3.94,6.07A8.2,8.2,0,0,1,64,102a8.2,8.2,0,0,1-5.5-1.61,14.31,14.31,0,0,1-3.94-6.07C52.09,87.93,50.88,78,50.88,64s1.21-23.93,3.68-30.29a14.31,14.31,0,0,1,3.94-6.07A8.2,8.2,0,0,1,64,26m0-10C44.81,16,40.88,37.51,40.88,64S44.81,112,64,112,87.12,90.49,87.12,64,83.19,16,64,16Z"/></g></svg>`,
  unlink: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 54.971 54.971" aria-hidden="true"><g fill="currentColor"><path d="M51.173,3.801c-5.068-5.068-13.315-5.066-18.384,0l-9.192,9.192c-0.781,0.781-0.781,2.047,0,2.828c0.781,0.781,2.047,0.781,2.828,0l9.192-9.192c1.691-1.69,3.951-2.622,6.363-2.622c2.413,0,4.673,0.932,6.364,2.623s2.623,3.951,2.623,6.364c0,2.412-0.932,4.672-2.623,6.363L36.325,31.379c-3.51,3.508-9.219,3.508-12.729,0c-0.781-0.781-2.047-0.781-2.828,0s-0.781,2.048,0,2.828c2.534,2.534,5.863,3.801,9.192,3.801s6.658-1.267,9.192-3.801l12.021-12.021c2.447-2.446,3.795-5.711,3.795-9.192C54.968,9.512,53.62,6.248,51.173,3.801z"/><path d="M27.132,40.57l-7.778,7.778c-1.691,1.691-3.951,2.623-6.364,2.623c-2.412,0-4.673-0.932-6.364-2.623c-3.509-3.509-3.509-9.219,0-12.728L17.94,24.306c1.691-1.69,3.951-2.622,6.364-2.622c2.412,0,4.672,0.932,6.363,2.622c0.781,0.781,2.047,0.781,2.828,0s0.781-2.047,0-2.828c-5.067-5.067-13.314-5.068-18.384,0L3.797,32.793c-2.446,2.446-3.794,5.711-3.794,9.192c0,3.48,1.348,6.745,3.795,9.191c2.446,2.447,5.711,3.795,9.191,3.795c3.481,0,6.746-1.348,9.192-3.795l7.778-7.778c0.781-0.781,0.781-2.047,0-2.828S27.913,39.789,27.132,40.57z"/></g></svg>`,
  verified: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.55879 3.6972C10.7552 2.02216 13.2447 2.02216 14.4412 3.6972L14.6317 3.96387C14.8422 4.25867 15.1958 4.41652 15.5558 4.37652L16.4048 4.28218C18.3156 4.06988 19.9301 5.68439 19.7178 7.59513L19.6235 8.44415C19.5835 8.8042 19.7413 9.15774 20.0361 9.36831L20.3028 9.55879C21.9778 10.7552 21.9778 13.2447 20.3028 14.4412L20.0361 14.6317C19.7413 14.8422 19.5835 15.1958 19.6235 15.5558L19.7178 16.4048C19.9301 18.3156 18.3156 19.9301 16.4048 19.7178L15.5558 19.6235C15.1958 19.5835 14.8422 19.7413 14.6317 20.0361L14.4412 20.3028C13.2447 21.9778 10.7553 21.9778 9.55879 20.3028L9.36831 20.0361C9.15774 19.7413 8.8042 19.5835 8.44414 19.6235L7.59513 19.7178C5.68439 19.9301 4.06988 18.3156 4.28218 16.4048L4.37652 15.5558C4.41652 15.1958 4.25867 14.8422 3.96387 14.6317L3.6972 14.4412C2.02216 13.2447 2.02216 10.7553 3.6972 9.55879L3.96387 9.36831C4.25867 9.15774 4.41652 8.8042 4.37652 8.44414L4.28218 7.59513C4.06988 5.68439 5.68439 4.06988 7.59513 4.28218L8.44415 4.37652C8.8042 4.41652 9.15774 4.25867 9.36831 3.96387L9.55879 3.6972ZM15.7071 9.29289C16.0976 9.68342 16.0976 10.3166 15.7071 10.7071L11.8882 14.526C11.3977 15.0166 10.6023 15.0166 10.1118 14.526L8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929C8.68342 10.9024 9.31658 10.9024 9.70711 11.2929L11 12.5858L14.2929 9.29289C14.6834 8.90237 15.3166 8.90237 15.7071 9.29289Z" fill="currentColor"/></svg>`,
  found: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.25007 2.38782C8.54878 2.0992 10.1243 2 12 2C13.8757 2 15.4512 2.0992 16.7499 2.38782C18.06 2.67897 19.1488 3.176 19.9864 4.01358C20.824 4.85116 21.321 5.94002 21.6122 7.25007C21.9008 8.54878 22 10.1243 22 12C22 13.8757 21.9008 15.4512 21.6122 16.7499C21.321 18.06 20.824 19.1488 19.9864 19.9864C19.1488 20.824 18.06 21.321 16.7499 21.6122C15.4512 21.9008 13.8757 22 12 22C10.1243 22 8.54878 21.9008 7.25007 21.6122C5.94002 21.321 4.85116 20.824 4.01358 19.9864C3.176 19.1488 2.67897 18.06 2.38782 16.7499C2.0992 15.4512 2 13.8757 2 12C2 10.1243 2.0992 8.54878 2.38782 7.25007C2.67897 5.94002 3.176 4.85116 4.01358 4.01358C4.85116 3.176 5.94002 2.67897 7.25007 2.38782ZM15.7071 9.29289C16.0976 9.68342 16.0976 10.3166 15.7071 10.7071L12.0243 14.3899C11.4586 14.9556 10.5414 14.9556 9.97568 14.3899L8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929C8.68342 10.9024 9.31658 10.9024 9.70711 11.2929L11 12.5858L14.2929 9.29289C14.6834 8.90237 15.3166 8.90237 15.7071 9.29289Z" fill="currentColor"/></svg>`,
  notLocated: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.25007 2.38782C8.54878 2.0992 10.1243 2 12 2C13.8757 2 15.4512 2.0992 16.7499 2.38782C18.06 2.67897 19.1488 3.176 19.9864 4.01358C20.824 4.85116 21.321 5.94002 21.6122 7.25007C21.9008 8.54878 22 10.1243 22 12C22 13.8757 21.9008 15.4512 21.6122 16.7499C21.321 18.06 20.824 19.1488 19.9864 19.9864C19.1488 20.824 18.06 21.321 16.7499 21.6122C15.4512 21.9008 13.8757 22 12 22C10.1243 22 8.54878 21.9008 7.25007 21.6122C5.94002 21.321 4.85116 20.824 4.01358 19.9864C3.176 19.1488 2.67897 18.06 2.38782 16.7499C2.0992 15.4512 2 13.8757 2 12C2 10.1243 2.0992 8.54878 2.38782 7.25007C2.67897 5.94002 3.176 4.85116 4.01358 4.01358C4.85116 3.176 5.94002 2.67897 7.25007 2.38782ZM9.00006 9C9.55234 9 10.0001 9.44772 10.0001 10V10.0112C10.0001 10.5635 9.55234 11.0112 9.00006 11.0112C8.44777 11.0112 8.00006 10.5635 8.00006 10.0112V10C8.00006 9.44772 8.44777 9 9.00006 9ZM7.39948 16.7996C7.84107 17.1313 8.46793 17.0422 8.79962 16.6006C9.53108 15.6268 10.6924 15 12.0004 15C13.3084 15 14.4698 15.6268 15.2012 16.6006C15.5329 17.0422 16.1598 17.1313 16.6014 16.7996C17.043 16.4679 17.132 15.841 16.8004 15.3994C15.7074 13.9443 13.9641 13 12.0004 13C10.0368 13 8.29344 13.9443 7.20049 15.3994C6.8688 15.841 6.95789 16.4679 7.39948 16.7996ZM16.0001 10C16.0001 9.44772 15.5523 9 15.0001 9C14.4478 9 14.0001 9.44772 14.0001 10V10.0112C14.0001 10.5635 14.4478 11.0112 15.0001 11.0112C15.5523 11.0112 16.0001 10.5635 16.0001 10.0112V10Z" fill="currentColor"/></svg>`,
  spotify: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6c-.15-.5.15-1 .6-1.15c3.55-1.05 9.4-.85 13.1 1.35c.45.25.6.85.35 1.3c-.25.35-.85.5-1.3.25m-.1 2.8c-.25.35-.7.5-1.05.25c-2.7-1.65-6.8-2.15-9.95-1.15c-.4.1-.85-.1-.95-.5c-.1-.4.1-.85.5-.95c3.65-1.1 8.15-.55 11.25 1.35c.3.15.45.65.2 1m-1.2 2.75c-.2.3-.55.4-.85.2c-2.35-1.45-5.3-1.75-8.8-.95c-.35.1-.65-.15-.75-.45c-.1-.35.15-.65.45-.75c3.8-.85 7.1-.5 9.7 1.1c.35.15.4.55.25.85M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2Z"/></svg>`,
  qobuz: `<svg id="Calque_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="1.8" fill="currentColor"/><path d="M50,29.1c-11.6,0-20.9,9.4-20.9,20.9s9.3,20.9,20.9,20.9,9.5-1.7,13.1-4.5l-4.8-4.7h0c-.4-.5-.6-1.1-.6-1.7,0-1.3,1-2.3,2.3-2.3s1.4.4,1.8.9l4.5,4.6c2.9-3.6,4.7-8.2,4.7-13.2,0-11.5-9.3-20.9-20.9-20.9ZM50,58.2c-4.5,0-8.2-3.7-8.2-8.2s3.7-8.2,8.2-8.2,8.2,3.6,8.2,8.2-3.6,8.2-8.2,8.2Z" fill="currentColor"/><path d="M50,0C22.4,0,0,22.4,0,50s22.4,50,50,50,50-22.4,50-50S77.6,0,50,0ZM75.7,72.8l-3.1,2.9-5.9-5.8c-4.5,3.8-10.3,6.1-16.7,6.1-14.4,0-26-11.6-26-26s11.6-26,26-26,26,11.6,26,26-2.3,12.3-6.2,16.9l5.9,5.9Z" fill="currentColor"/></svg>`,
  pandora: `<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M25.401 0h-18.803c-3.599 0-6.599 2.964-6.599 6.599v18.803c0 3.599 2.959 6.599 6.599 6.599h18.803c3.635 0 6.599-2.964 6.599-6.599v-18.803c0-3.599-2.964-6.599-6.599-6.599zM16.5 21.083h-1.64v3.72c0 0.479-0.401 0.859-0.86 0.859h-5.14v-19.317h8.739c4.245 0 7.527 2.197 7.527 7.197 0 4.74-3.641 7.537-8.604 7.537h-0.021z"/></svg>`,
  soundCloud: `<svg fill="currentColor" viewBox="-271 345.8 256 111.2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g><path d="M-238.4,398.1c-0.8,0-1.4,0.6-1.5,1.5l-2.3,28l2.3,27.1c0.1,0.8,0.7,1.5,1.5,1.5c0.8,0,1.4-0.6,1.5-1.5l2.6-27.1l-2.6-28C-237,398.7-237.7,398.1-238.4,398.1z"/><path d="M-228.2,399.9c-0.9,0-1.7,0.7-1.7,1.7l-2.1,26l2.1,27.3c0.1,1,0.8,1.7,1.7,1.7c0.9,0,1.6-0.7,1.7-1.7l2.4-27.3l-2.4-26C-226.6,400.6-227.3,399.9-228.2,399.9z"/><path d="M-258.6,403.5c-0.5,0-1,0.4-1.1,1l-2.5,23l2.5,22.5c0.1,0.6,0.5,1,1.1,1c0.5,0,1-0.4,1.1-1l2.9-22.5l-2.9-23C-257.7,404-258.1,403.5-258.6,403.5z"/><path d="M-268.1,412.3c-0.5,0-1,0.4-1,1l-1.9,14.3l1.9,14c0.1,0.6,0.5,1,1,1s0.9-0.4,1-1l2.2-14l-2.2-14.2C-267.2,412.8-267.6,412.3-268.1,412.3z"/><path d="M-207.5,373.5c-1.2,0-2.1,0.9-2.2,2.1l-1.9,52l1.9,27.2c0.1,1.2,1,2.1,2.2,2.1s2.1-0.9,2.2-2.1l2.1-27.2l-2.1-52C-205.4,374.4-206.4,373.5-207.5,373.5z"/><path d="M-248.6,399c-0.7,0-1.2,0.5-1.3,1.3l-2.4,27.3l2.4,26.3c0.1,0.7,0.6,1.3,1.3,1.3c0.7,0,1.2-0.5,1.3-1.2l2.7-26.3l-2.7-27.3C-247.4,399.6-247.9,399-248.6,399z"/><path d="M-217.9,383.4c-1,0-1.9,0.8-1.9,1.9l-2,42.3l2,27.3c0.1,1.1,0.9,1.9,1.9,1.9s1.9-0.8,1.9-1.9l2.3-27.3l-2.3-42.3C-216,384.2-216.9,383.4-217.9,383.4z"/><path d="M-154.4,359.3c-1.8,0-3.2,1.4-3.2,3.2l-1.2,65l1.2,26.1c0,1.8,1.5,3.2,3.2,3.2c1.8,0,3.2-1.5,3.2-3.2l1.4-26.1l-1.4-65C-151.1,360.8-152.6,359.3-154.4,359.3z"/><path d="M-197.1,368.9c-1.3,0-2.3,1-2.4,2.4l-1.8,56.3l1.8,26.9c0,1.3,1.1,2.3,2.4,2.3s2.3-1,2.4-2.4l2-26.9l-2-56.3C-194.7,370-195.8,368.9-197.1,368.9z"/><path d="M-46.5,394c-4.3,0-8.4,0.9-12.2,2.4C-61.2,368-85,345.8-114,345.8c-7.1,0-14,1.4-20.1,3.8c-2.4,0.9-3,1.9-3,3.7v99.9c0,1.9,1.5,3.5,3.4,3.7c0.1,0,86.7,0,87.3,0c17.4,0,31.5-14.1,31.5-31.5C-15,408.1-29.1,394-46.5,394z"/><path d="M-143.6,353.2c-1.9,0-3.4,1.6-3.5,3.5l-1.4,70.9l1.4,25.7c0,1.9,1.6,3.4,3.5,3.4c1.9,0,3.4-1.6,3.5-3.5l1.5-25.8l-1.5-70.9C-140.2,354.8-141.7,353.2-143.6,353.2z"/><path d="M-186.5,366.8c-1.4,0-2.5,1.1-2.6,2.6l-1.6,58.2l1.6,26.7c0,1.4,1.2,2.6,2.6,2.6s2.5-1.1,2.6-2.6l1.8-26.7l-1.8-58.2C-184,367.9-185.1,366.8-186.5,366.8z"/><path d="M-175.9,368.1c-1.5,0-2.8,1.2-2.8,2.8l-1.5,56.7l1.5,26.5c0,1.6,1.3,2.8,2.8,2.8s2.8-1.2,2.8-2.8l1.7-26.5l-1.7-56.7C-173.1,369.3-174.3,368.1-175.9,368.1z"/><path d="M-165.2,369.9c-1.7,0-3,1.3-3,3l-1.4,54.7l1.4,26.3c0,1.7,1.4,3,3,3c1.7,0,3-1.3,3-3l1.5-26.3l-1.5-54.7C-162.2,371.3-163.5,369.9-165.2,369.9z"/></g></svg>`,
  appleMusic: `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m24 6.124c0-.029.001-.063.001-.097 0-.743-.088-1.465-.253-2.156l.013.063c-.312-1.291-1.1-2.359-2.163-3.031l-.02-.012c-.536-.35-1.168-.604-1.847-.723l-.03-.004c-.463-.084-1.003-.138-1.553-.15h-.011c-.04 0-.083-.01-.124-.013h-12.025c-.152.01-.3.017-.455.026-.791.016-1.542.161-2.242.415l.049-.015c-1.306.501-2.327 1.495-2.853 2.748l-.012.033c-.17.409-.297.885-.36 1.38l-.003.028c-.051.343-.087.751-.1 1.165v.016c0 .032-.007.062-.01.093v12.224c.01.14.017.283.027.424.02.861.202 1.673.516 2.416l-.016-.043c.609 1.364 1.774 2.387 3.199 2.792l.035.009c.377.111.817.192 1.271.227l.022.001c.555.053 1.11.06 1.667.06h11.028c.554 0 1.099-.037 1.633-.107l-.063.007c.864-.096 1.645-.385 2.321-.823l-.021.013c.825-.539 1.47-1.29 1.867-2.176l.013-.032c.166-.383.295-.829.366-1.293l.004-.031c.084-.539.132-1.161.132-1.794 0-.086-.001-.171-.003-.256v.013q0-5.7 0-11.394zm-6.424 3.99v5.712c.001.025.001.054.001.083 0 .407-.09.794-.252 1.14l.007-.017c-.273.562-.771.979-1.373 1.137l-.015.003c-.316.094-.682.156-1.06.173h-.01c-.029.002-.062.002-.096.002-1.033 0-1.871-.838-1.871-1.871 0-.741.431-1.382 1.056-1.685l.011-.005c.293-.14.635-.252.991-.32l.027-.004c.378-.082.758-.153 1.134-.24.264-.045.468-.252.51-.513v-.003c.013-.057.02-.122.02-.189 0-.002 0-.003 0-.005q0-2.723 0-5.443c-.001-.066-.01-.13-.027-.19l.001.005c-.026-.134-.143-.235-.283-.235-.006 0-.012 0-.018.001h.001c-.178.013-.34.036-.499.07l.024-.004q-1.14.225-2.28.456l-3.7.748c-.016 0-.032.01-.048.013-.222.03-.392.219-.392.447 0 .015.001.03.002.045v-.002.13q0 3.9 0 7.801c.001.028.001.062.001.095 0 .408-.079.797-.224 1.152l.007-.021c-.264.614-.792 1.072-1.436 1.235l-.015.003c-.319.096-.687.158-1.067.172h-.008c-.031.002-.067.003-.104.003-.913 0-1.67-.665-1.815-1.536l-.001-.011c-.02-.102-.031-.218-.031-.338 0-.785.485-1.458 1.172-1.733l.013-.004c.315-.127.687-.234 1.072-.305l.036-.005c.287-.06.575-.116.86-.177.341-.05.6-.341.6-.693 0-.007 0-.015 0-.022v.001-.15q0-4.44 0-8.883c0-.002 0-.004 0-.007 0-.129.015-.254.044-.374l-.002.011c.066-.264.277-.466.542-.517l.004-.001c.255-.066.515-.112.774-.165.733-.15 1.466-.3 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.4.181-.042.407-.079.637-.104l.027-.002c.018-.002.04-.004.061-.004.27 0 .489.217.493.485.008.067.012.144.012.222v.001q0 2.865 0 5.732z"/></svg>`,
  amazonMusic: `<svg id="Camada_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true"><path d="M622.6,539.3c29.9-12.1,83.1-28.2,99.2-8.8,17.3,21-4.6,66.6-24.7,102" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><path d="M72,553.3c47.3,37.6,186.9,95,335.7,95,97.7,2.3,193.3-26.7,273.3-82.7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><path d="M303.4,281.8v88.8c0,29.7,24,53.7,53.7,53.7h0c29.7,0,53.7-24,53.7-53.7v-88.8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><line x1="410.9" y1="370.6" x2="410.9" y2="424.3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><path d="M34.4,338.3c0-29.7,24-53.7,53.7-53.7h0c29.7,0,53.7,24,53.7,53.7v86" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><line x1="34.4" y1="284.6" x2="34.4" y2="424.3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><path d="M141.9,338.3c0-29.7,24-53.7,53.7-53.7h0c29.7,0,53.7,24,53.7,53.7v86" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><circle cx="611.6" cy="215.9" r="18.8" transform="translate(300.7 785.2) rotate(-80.8)" fill="currentColor"/><line x1="611.8" y1="281.8" x2="611.8" y2="424.3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><path d="M468.3,412.2c12.6,9.7,28.4,14,44.3,12h12c19.6,0,35.6-15.9,35.6-35.6h0c0-19.6-15.9-35.6-35.6-35.6h-24.2c-19.6,0-35.6-15.9-35.6-35.6h0c0-19.6,15.8-35.6,35.6-35.6h12c15.7-2,31.7,2.3,44.3,12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/><path d="M765.6,397.3c-9.6,16.8-27.4,27-46.7,27h0c-29.7,0-53.7-24-53.7-53.7v-34.9c0-29.7,24-53.7,53.7-53.7h0c19.3,0,37.1,10.3,46.6,27" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="30px"/></svg>`,
  amazonStore: `<svg version="1.1" viewBox="0 0 122.88 111.71" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g><path d="M33.848,54.85c0-5.139,1.266-9.533,3.798-13.182c2.532-3.649,5.995-6.404,10.389-8.266 c4.021-1.713,8.974-2.941,14.858-3.687c2.01-0.223,5.287-0.521,9.83-0.894v-1.899c0-4.766-0.521-7.968-1.564-9.607 c-1.564-2.235-4.021-3.351-7.373-3.351h-0.893c-2.458,0.223-4.581,1.005-6.368,2.345c-1.787,1.341-2.942,3.202-3.463,5.586 c-0.298,1.489-1.042,2.345-2.234,2.569l-12.847-1.564c-1.266-0.298-1.899-0.968-1.899-2.011c0-0.223,0.037-0.484,0.111-0.781 c1.266-6.628,4.375-11.543,9.328-14.746C50.473,2.161,56.264,0.373,62.893,0h2.793c8.488,0,15.117,2.197,19.885,6.591 c0.746,0.748,1.438,1.55,2.066,2.401c0.631,0.856,1.135,1.62,1.506,2.29c0.373,0.67,0.709,1.639,1.006,2.904 c0.299,1.267,0.521,2.142,0.672,2.625c0.148,0.484,0.26,1.527,0.334,3.129c0.074,1.601,0.111,2.55,0.111,2.848v27.034 c0,1.936,0.279,3.705,0.838,5.306c0.559,1.602,1.1,2.756,1.619,3.463c0.521,0.707,1.379,1.844,2.57,3.406 c0.447,0.672,0.67,1.268,0.67,1.789c0,0.596-0.297,1.115-0.895,1.563c-6.18,5.363-9.531,8.268-10.053,8.715 c-0.893,0.67-1.973,0.744-3.24,0.223c-1.041-0.895-1.953-1.75-2.736-2.57c-0.781-0.818-1.34-1.414-1.676-1.787 c-0.334-0.371-0.875-1.098-1.619-2.178s-1.268-1.807-1.564-2.178c-4.17,4.543-8.266,7.373-12.287,8.49 c-2.533,0.744-5.661,1.117-9.384,1.117c-5.735,0-10.445-1.77-14.131-5.307C35.691,66.336,33.848,61.328,33.848,54.85L33.848,54.85z M53.062,52.615c0,2.905,0.727,5.232,2.178,6.982c1.453,1.75,3.407,2.625,5.865,2.625c0.224,0,0.54-0.037,0.95-0.111 c0.408-0.076,0.688-0.113,0.838-0.113c3.127-0.818,5.547-2.828,7.26-6.031c0.82-1.415,1.434-2.96,1.844-4.636 c0.41-1.675,0.633-3.035,0.67-4.078c0.037-1.042,0.057-2.755,0.057-5.138v-2.793c-4.32,0-7.596,0.298-9.83,0.894 C56.338,42.077,53.062,46.21,53.062,52.615L53.062,52.615z" fill="currentColor"/><path fill="currentColor" d="M99.979,88.586c0.15-0.299,0.373-0.596,0.672-0.895c1.861-1.266,3.648-2.121,5.361-2.568 c2.83-0.744,5.586-1.154,8.266-1.229c0.746-0.076,1.453-0.037,2.123,0.111c3.352,0.297,5.361,0.857,6.033,1.676 c0.297,0.447,0.445,1.117,0.445,2.01v0.783c0,2.605-0.707,5.678-2.121,9.215c-1.416,3.537-3.389,6.387-5.922,8.547 c-0.371,0.297-0.707,0.445-1.004,0.445c-0.15,0-0.299-0.037-0.447-0.111c-0.447-0.223-0.559-0.633-0.336-1.229 c2.756-6.479,4.133-10.984,4.133-13.518c0-0.818-0.148-1.414-0.445-1.787c-0.746-0.893-2.83-1.34-6.256-1.34 c-1.268,0-2.756,0.074-4.469,0.223c-1.861,0.225-3.574,0.447-5.139,0.672c-0.447,0-0.744-0.076-0.895-0.225 c-0.148-0.148-0.186-0.297-0.111-0.447C99.867,88.846,99.904,88.734,99.979,88.586L99.979,88.586z M0.223,86.688 c0.373-0.596,0.968-0.633,1.788-0.113c18.618,10.799,38.875,16.199,60.769,16.199c14.598,0,29.008-2.719,43.232-8.156 c0.371-0.148,0.912-0.371,1.619-0.67c0.709-0.297,1.211-0.521,1.508-0.67c1.117-0.447,1.992-0.223,2.625,0.67 c0.635,0.895,0.43,1.713-0.613,2.457c-1.342,0.969-3.055,2.086-5.139,3.352c-6.404,3.799-13.555,6.74-21.449,8.826 c-7.893,2.086-15.602,3.127-23.123,3.127c-11.618,0-22.603-2.029-32.954-6.088C18.134,101.563,8.862,95.846,0.67,88.475 C0.223,88.102,0,87.729,0,87.357C0,87.133,0.074,86.91,0.223,86.688L0.223,86.688z"/></g></svg>`,
  itunes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true"><g fill="currentColor"><path d="M287.4,603.3c2.8,0,5.6-.2,8.4-.5,36.8-4.6,64.5-38.2,61.8-74.9,0,0,0-.1,0-.2,0-.4.1-.8.1-1.2v-199.9l144.2-26.9v147.5c-7.7-1.9-15.9-2.4-24-1.3-36.9,4.6-64.7,38.3-61.9,75.1,2.6,34,30.2,59.6,64.2,59.6s5.6-.2,8.5-.5c36.9-4.6,64.6-38.3,61.9-75.1v-.2c0-.3,0-.7,0-1V203.8c.3-2.4-.9-4.6-2.9-6-1.5-1-3.3-1.3-5.1-.9,0,0,0,0,0,0l-228.2,38.9c-3.2.5-5.5,3.3-5.5,6.5v227.7c-7.7-1.9-15.9-2.4-24-1.4-37,4.6-64.7,38.3-61.8,75.1,2.6,34,30.2,59.6,64.3,59.6Z"/><path d="M400,0C179.4,0,0,179.4,0,400s179.4,400,400,400,400-179.4,400-400S620.6,0,400,0ZM400,725.8c-179.7,0-325.8-146.2-325.8-325.8S220.3,74.2,400,74.2s325.8,146.2,325.8,325.8-146.2,325.8-325.8,325.8Z"/></g></svg>`,

  youtube: `<svg width="20" height="20" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7.98843,9.58588 L7.98843,3.97425 C9.98064,4.91168 11.5236,5.8172 13.34846,6.79353 C11.84335,7.62824 9.98064,8.56468 7.98843,10.58588 M19.091,1.18289 C18.74734,0.73013 18.16163,0.37809 17.53807,0.26141 C15.70524,-0.08664 4.27097,-0.08763 2.43914,0.26141 C1.9391,0.35515 1.49384,0.58153 1.11134,0.93357 C-0.50036,2.42947 0.00466,10.45151 0.39315,11.75096 C0.55651,12.31342 0.76768,12.71931 1.03364,12.98558 C1.3763,13.33761 1.84546,13.57995 2.38436,13.68865 C3.89345,14.0008 11.66804,14.17532 17.5062,13.73552 C18.04409,13.64178 18.52023,13.39147 18.89576,13.02447 C20.38593,11.53455 20.28433,3.06174 19.091,1.18289" fill="currentColor" transform="translate(0, 3)"></path></svg>`,
  youTube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" aria-hidden="true"><path fill="currentColor" d="M400,20C190.1,20,20,190.6,20,401c20,505.4,740.1,505.3,760,0,0-210.4-170.1-381-380-381ZM400,619.2c-120.3,0-218.2-97.9-218.2-218.2,5.9-149.3,117.2-217.1,218.2-217.1h0c100.9,0,212.2,67.8,218.1,216.6,0,120.8-97.9,218.6-218.1,218.6Z"/><path fill="currentColor" d="M400,208.8c-127.6,0-189.6,99.9-193.3,192.7,0,106.1,86.7,192.8,193.3,192.8s193.3-86.7,193.3-193.3c-3.7-92.3-65.7-192.2-193.3-192.2ZM328.4,503.9c0-20.7,0-63.1,0-83.7v-122l174.4,98.4-174.4,107.3Z"/></svg>`,
  deezer: `<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M24.511 22.011v3.785h6.484v-3.786h-6.486zM16.676 22.011v3.785h6.486v-3.786h-6.486zM8.84 22.011v3.785h6.484v-3.786h-6.486zM1.004 22.011v3.785h6.486v-3.786h-6.486zM24.511 16.742v3.783h6.484v-3.783h-6.484zM16.676 16.742v3.783h6.486v-3.783zM8.84 16.742v3.783h6.484v-3.783h-6.484zM24.51 11.476v3.783h6.486v-3.783zM8.84 11.476v3.783h6.484v-3.783h-6.484zM24.51 6.203v3.786h6.486v-3.786z"></path></svg>`,
  bandcamp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.29 6L2 18h14.71L22 6z"/></svg>`,
  tidal: `<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16.016 5.323l-5.339 5.339-5.339-5.339-5.339 5.339 5.339 5.339 5.339-5.339 5.339 5.339-5.339 5.339 5.339 5.339 5.339-5.339-5.339-5.339 5.339-5.339zM21.391 10.661l5.302-5.307 5.307 5.307-5.307 5.307z"/></svg>`
};

const PLATFORM_META = {
  appleMusic: { name: "apple music", icon: SVG_ICONS.appleMusic, section: "principais", order: 1, isPrimaryCopy: true, appScheme: "music://" },
  spotify: { name: "spotify", icon: SVG_ICONS.spotify, section: "principais", order: 2, isPrimaryCopy: true, appScheme: "spotify://" },
  youTube: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true, appScheme: "youtubemusic://" },
  youtube: { name: "youtube", icon: SVG_ICONS.youtube, section: "outras", order: 12, isPrimaryCopy: false, appScheme: "youtube://" },
  youtubeMusic: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true, appScheme: "youtubemusic://" },
  deezer: { name: "deezer", icon: SVG_ICONS.deezer, section: "principais", order: 4, isPrimaryCopy: true, appScheme: "deezer://" },
  tidal: { name: "tidal", icon: SVG_ICONS.tidal, section: "principais", order: 5, isPrimaryCopy: true, appScheme: "tidal://" },
  amazonMusic: { name: "amazon music", icon: SVG_ICONS.amazonMusic, section: "principais", order: 6, isPrimaryCopy: true, appScheme: null },
  amazonStore: { name: "amazon store", icon: SVG_ICONS.amazonStore, section: "outras", order: 11, isPrimaryCopy: false, appScheme: null },
  soundCloud: { name: "soundcloud", icon: SVG_ICONS.soundCloud, section: "outras", order: 6, isPrimaryCopy: false, appScheme: "soundcloud://" },
  pandora: { name: "pandora", icon: SVG_ICONS.pandora, section: "outras", order: 7, isPrimaryCopy: false, appScheme: "pandora://" },
  qobuz: { name: "qobuz", icon: SVG_ICONS.qobuz, section: "outras", order: 8, isPrimaryCopy: false, appScheme: "qobuz://" },
  itunes: { name: "itunes", icon: SVG_ICONS.itunes, section: "outras", order: 9, isPrimaryCopy: false, appScheme: null },
  bandcamp: { name: "bandcamp", icon: SVG_ICONS.bandcamp, section: "outras", order: 10, isPrimaryCopy: false, appScheme: null }
};

const SUPPORTED_PLATFORM_CHIPS = [
  "appleMusic",
  "spotify",
  "youTube",
  "deezer",
  "tidal",
  "soundCloud",
  "pandora",
  "qobuz"
];
const MADE_BY_SIGNATURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" role="img" aria-label="Leo Saquetto signature"><g fill="currentColor"><path d="M147.7,27.1c-1.1,6.5-2.4,14.1-3.7,21.7-1.2,6.7-2.4,13.3-3.7,19.9-1.9,10.3-7.3,17-15.7,20.2-5.5,2.1-11.2,3.5-17.1,2.4-5-.9-8.2-5.2-8.4-11.1-.2-7.2,1.6-14.1,2.8-21.1,1.4-8.7,3-17.3,4.6-25.9,2.4-13.3,8.2-19.6,19.7-21.6,4.6-.8,9.1-.9,13.6.6,6.1,2.1,8.6,6.5,8,15.1ZM116.1,70.9c0,2.1-.4,3.9,1.2,4.7,1.6.8,3.2.4,4.6-1.1,1.4-1.5,1.9-3.6,2.3-5.7,1.8-10.1,3.6-20.2,5.4-30.3.6-3.2,1.2-6.4,1.6-9.6.3-2.7-.9-3.9-3.2-3.6-2.3.3-3.9,2.1-4.6,5.5-1,5.1-1.9,10.2-2.8,15.3-1.5,8.5-3.1,16.9-4.5,24.9Z"/><path d="M257.5,70.2c2.1,1.4,3.9.6,5.7,0,1.4-.5,1.7-.4,1.5,1.5-1.2,8-4.7,11.5-11.4,11.1-2.7-.2-5-1.4-6-4.5-.5-1.5-1.2-1.6-2.4-1.4-2.8.4-5.5.5-8.3-.2-6.6-1.6-9.8-6.9-8.5-14.7,1.8-11,4.2-21.9,6.2-32.9.7-3.8,1.4-7.6,3.1-11,1.9-3.9,4.5-6.6,8-8.3,6.7-3.1,13.7-3.6,20.6-1.6,6.1,1.8,8.5,6.9,7.2,14.2-2.3,11.9-4.5,23.8-6.9,35.7-1.4,6.7-3.4,9.4-8.7,12.3Z"/><path d="M472.5,74.9c-6.1.2-12.1.5-18.2.7-13.6.3-27.1.5-40.7,1-15.4.5-30.9,1-46.3,1.8-14.3.7-28.6,1.4-43,2.4-15.7,1-31.3,2.1-47,3.3-17.5,1.4-35.1,2.9-52.6,4.5-18.5,1.7-37,3.6-55.4,5.9-8.2,1-16.5,1.4-24.6,3.1-21.3,4.5-42.4,9.7-63.5,15.1-.8.2-1.8,0-2.9,1.4,38.8-6.3,77.3-12.4,115.9-16-17.4,3.9-34.9,7.8-52.6,11.8.8.9,1.3.7,1.8.6,16.1-2.4,32.3-3.8,48.4-5.7,2.4-.3,4.5-.4,6.3.5h0s4.3-.5,4.3-.5c-.1-.2-.3-.5-.4-.7,1.3-.8,2.1-.6,2.7.4l6.4-.8c-.1-.3-.3-.6-.5-1,4-.5,7.7-1,11.3-1.5l117.1-12.9c.3,0,.6-.1,1-.1.9,0,1.9,0,2.8-.2l2.8-.3c.7,0,1.4-.2,2.1-.2.6,0,1.3-.4,1.8-.2l15.7-1.4c13.9-1.3,27.8-2.9,41.8-4.1,22.5-1.9,44.9-4.4,67.4-5.7.4,0,.9.1,1-.7-.9-.6-1.9-.3-2.8-.3Z"/></g></svg>`;

const state = {
  currentResult: null,
  currentOriginalUrl: null,
  autoConvertedFromQuery: false,
  statusHideTimer: null,
  floatingToastTimer: null,
  floatingToastHideTimer: null,
  lastClipboardText: "",
  lastAutoUrl: "",
  activeButtonResetTimers: new WeakMap(),
  scrollAfterConvert: false,
  hideResultTimer: null,
  themeSwitchTimer: null,
  languageSwitchTimer: null,
  currentLanguage: "pt-br",
  isLanguageMenuOpen: false,
  isSearchMode: false,
  isIOSInstallModalOpen: false,
  iosInstallModalHideTimer: null,
  isRecentSwapsModalOpen: false,
  recentSwapsModalHideTimer: null,
  isLegalModalOpen: false,
  legalModalHideTimer: null,
  activeLegalType: "privacy",
  modalScrollLockDepth: 0,
  lockedScrollY: 0,
  recentSwaps: [],
  shuffleInProgress: false
};

const els = {
  inputLabel: document.getElementById("inputLabel"),
  input: document.getElementById("linkInput"),
  convertButton: document.getElementById("convertButton"),
  clearButton: document.getElementById("clearButton"),
  pasteButton: document.getElementById("pasteButton"),
  useSampleButton: document.getElementById("useSampleButton"),
  searchModeButton: document.getElementById("searchModeButton"),
  recentSwapsButton: document.getElementById("recentSwapsButton"),
  supportedChips: document.getElementById("supportedChips"),
  statusCard: document.getElementById("statusCard"),
  resultCard: document.getElementById("resultCard"),
  coverWrap: document.getElementById("coverWrap"),
  coverShimmer: document.getElementById("coverShimmer"),
  coverImage: document.getElementById("coverImage"),
  resultDescription: document.getElementById("resultDescription"),
  resultTitle: document.getElementById("resultTitle"),
  resultMeta: document.getElementById("resultMeta"),
  platformGroups: document.getElementById("platformGroups"),
  resultLegend: document.getElementById("resultLegend"),
  resultPoweredBy: document.getElementById("resultPoweredBy"),
  resultDismissButton: document.getElementById("resultDismissButton"),
  copyPrimaryButton: document.getElementById("copyPrimaryButton"),
  copyOriginalButton: document.getElementById("copyOriginalButton"),
  sharePrimaryButton: document.getElementById("sharePrimaryButton"),
  floatingToast: document.getElementById("floatingToast"),
  themeToggle: document.getElementById("themeToggle"),
  languageToggle: document.getElementById("languageToggle"),
  languageDropdown: document.getElementById("languageDropdown"),
  languageMenu: document.getElementById("languageMenu"),
  appShell: document.getElementById("appShell"),
  iosInstallAvailability: document.getElementById("iosInstallAvailability"),
  iosShortcutAvailability: document.getElementById("iosShortcutAvailability"),
  footerMadeByText: document.getElementById("footerMadeByText"),
  madeBySignature: document.getElementById("madeBySignature"),
  viewportFillSpacer: document.getElementById("viewportFillSpacer"),
  heroLogo: document.querySelector(".app-logo"),
  iosInstallCta: document.getElementById("iosInstallCta"),
  iosInstallModal: document.getElementById("iosInstallModal"),
  iosInstallBackdrop: document.getElementById("iosInstallBackdrop"),
  iosInstallClose: document.getElementById("iosInstallClose"),
  recentSwapsModal: document.getElementById("recentSwapsModal"),
  recentSwapsBackdrop: document.getElementById("recentSwapsBackdrop"),
  recentSwapsClose: document.getElementById("recentSwapsClose"),
  recentSwapsList: document.getElementById("recentSwapsList"),
  clearRecentSwapsButton: document.getElementById("clearRecentSwapsButton"),
  clearRecentSwapsText: document.getElementById("clearRecentSwapsText"),
  recentSwapsTitle: document.getElementById("recentSwapsTitle"),
  privacyPolicyButton: document.getElementById("privacyPolicyButton"),
  termsOfUseButton: document.getElementById("termsOfUseButton"),
  legalModal: document.getElementById("legalModal"),
  legalBackdrop: document.getElementById("legalBackdrop"),
  legalClose: document.getElementById("legalClose"),
  legalModalTitle: document.getElementById("legalModalTitle"),
  legalModalBody: document.getElementById("legalModalBody")
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  forceHeroGifLogo();
  syncSearchModeUI();
  updateConvertButtonLabel();
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
});

function bootstrap() {
  forceHeroGifLogo();
  installIOSViewportBounceGuard();
  initIOSViewportFillAssist();
  injectButtonIcons();
  renderSupportedChips();
  hydrateRecentSwaps();
  initLanguage();
  initTheme();
  initIOSInstallPrompt();
  bindEvents();
  bindLaunchQueueConsumer();
  hydrateFromIncomingUrl();
  tryAutoPasteFromClipboard();
}

function forceHeroGifLogo() {
  if (!els.heroLogo) return;
  if (els.heroLogo.src !== HERO_LOGO_GIF_URL) {
    els.heroLogo.src = HERO_LOGO_GIF_URL;
  }
}

function getCurrentLanguage() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return TRANSLATIONS[saved] ? saved : "pt-br";
}

function t(key) {
  const lang = TRANSLATIONS[state.currentLanguage] ? state.currentLanguage : "pt-br";
  return TRANSLATIONS[lang][key] ?? TRANSLATIONS["pt-br"][key] ?? key;
}

function tCount(key, count) {
  return t(key).replace("{count}", String(count));
}

function initLanguage() {
  state.currentLanguage = getCurrentLanguage();
  if (els.languageToggle) {
    els.languageToggle.innerHTML = `<span class="button-icon">${SVG_ICONS.globe}</span>`;
  }
  renderLanguageDropdown();
  applyLanguage({ announce: false, withTransition: false });
}

function renderLanguageDropdown() {
  if (!els.languageDropdown) return;
  els.languageDropdown.innerHTML = LANGUAGE_OPTIONS.map(option => (
    `<button class="language-option ${option.value === state.currentLanguage ? "is-active" : ""}" type="button" data-language="${option.value}" role="menuitem">${
      option.label === "PT-BR" ? `<span class="language-split"><span>PT</span><span>BR</span></span>` : option.label
    }</button>`
  )).join("");
  els.languageDropdown.querySelectorAll("[data-language]").forEach(button => {
    button.addEventListener("click", () => {
      applyLanguage({ lang: button.getAttribute("data-language"), announce: true, withTransition: true });
      closeLanguageMenu();
    });
  });
}

function openLanguageMenu() {
  if (!els.languageMenu || !els.languageDropdown) return;
  state.isLanguageMenuOpen = true;
  els.languageMenu.classList.add("is-open");
  els.languageToggle?.classList.add("is-open");
}

function closeLanguageMenu() {
  if (!els.languageMenu || !els.languageDropdown) return;
  state.isLanguageMenuOpen = false;
  els.languageMenu.classList.remove("is-open");
  els.languageToggle?.classList.remove("is-open");
}

function applyLanguage({ lang = state.currentLanguage, announce = false, withTransition = true } = {}) {
  state.currentLanguage = TRANSLATIONS[lang] ? lang : "pt-br";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, state.currentLanguage);
  document.documentElement.lang = state.currentLanguage;
  renderLanguageDropdown();
  if (els.languageToggle) {
    els.languageToggle.setAttribute("aria-label", "selecionar idioma");
    els.languageToggle.setAttribute("title", "selecionar idioma");
  }
  const bylineEl = document.getElementById("heroByline");
  const subtitleEl = document.getElementById("heroSubtitle");
  if (bylineEl) bylineEl.textContent = t("byline");
  if (subtitleEl) subtitleEl.textContent = t("subtitle");
  if (els.iosInstallAvailability) els.iosInstallAvailability.textContent = t("availableAs");
  if (els.iosShortcutAvailability) els.iosShortcutAvailability.textContent = t("availableAs");
  if (els.footerMadeByText) els.footerMadeByText.textContent = t("madeBy");
  updateLocalizedStaticCopy();
  refreshLocalizedDynamicContent();
  syncSearchModeUI();
  updateConvertButtonLabel();
  syncThemeToggleIcon();
  if (announce) showFloatingToast(t("languageSelected"));
}

function updateLocalizedStaticCopy() {
  if (els.recentSwapsButton) {
    els.recentSwapsButton.setAttribute("aria-label", t("recentSwaps"));
    els.recentSwapsButton.setAttribute("title", t("recentSwaps"));
  }
  if (els.resultPoweredBy) {
    els.resultPoweredBy.classList.remove("hidden");
  }
  if (els.privacyPolicyButton) els.privacyPolicyButton.textContent = t("privacyPolicy");
  if (els.termsOfUseButton) els.termsOfUseButton.textContent = t("termsOfUse");
  if (els.clearRecentSwapsText) els.clearRecentSwapsText.textContent = t("clearSwaps");
}

function refreshLocalizedDynamicContent() {
  if (state.currentResult) {
    renderResult(state.currentResult, { skipSave: true });
    const directCount = (state.currentResult.links || []).filter(item => !item.isSearchResult).length;
    if (directCount > 0) {
      showStatus(directCount === 1 ? t("swapsFoundSingle") : tCount("swapsFoundPlural", directCount), "success");
    }
  }
  if (state.isRecentSwapsModalOpen) {
    renderRecentSwaps();
  }
  if (state.isLegalModalOpen) {
    renderLegalModalContent(state.activeLegalType);
  }
}

function initIOSViewportFillAssist() {
  const ua = navigator.userAgent || "";
  const isIOS = /iP(ad|hone|od)/.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isCriOS = /CriOS/i.test(ua);
  const isFxiOS = /FxiOS/i.test(ua);

  if (!isIOS || !isWebKit || isCriOS || isFxiOS || !els.viewportFillSpacer) return;

  const syncViewportFill = () => {
    const hasResult = !els.resultCard?.classList.contains("hidden");
    document.body.classList.toggle("needs-viewport-fill", !hasResult);

    if (!hasResult && window.scrollY === 0) {
      window.requestAnimationFrame(() => window.scrollTo(0, 1));
    }
  };

  syncViewportFill();

  const observer = new MutationObserver(syncViewportFill);
  if (els.resultCard) {
    observer.observe(els.resultCard, { attributes: true, attributeFilter: ["class"] });
  }

  window.addEventListener("resize", syncViewportFill);
}

function installIOSViewportBounceGuard() {
  const ua = navigator.userAgent || "";
  const isIOS = /iP(ad|hone|od)/.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isCriOS = /CriOS/i.test(ua);
  const isFxiOS = /FxiOS/i.test(ua);

  if (!isIOS || !isWebKit || isCriOS || isFxiOS) return;

  let startY = 0;
  let startX = 0;

  const getScrollableParent = target => {
    let node = target instanceof Element ? target : null;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const canScrollY = /(auto|scroll)/.test(style.overflowY || "");
      if (canScrollY && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  document.addEventListener(
    "touchstart",
    event => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startY = touch.clientY;
      startX = touch.clientX;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    event => {
      const touch = event.touches?.[0];
      if (!touch) return;

      const deltaY = touch.clientY - startY;
      const deltaX = touch.clientX - startX;
      const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);
      if (!isVerticalSwipe) return;

      const localScrollable = getScrollableParent(event.target);
      if (localScrollable) {
        const localAtTop = localScrollable.scrollTop <= 0;
        const localAtBottom = localScrollable.scrollTop + localScrollable.clientHeight >= localScrollable.scrollHeight - 1;
        const canScrollUp = deltaY < 0 && !localAtBottom;
        const canScrollDown = deltaY > 0 && !localAtTop;
        if (canScrollUp || canScrollDown) return;
      }

      const scrollRoot = document.scrollingElement || document.documentElement;
      const atTop = scrollRoot.scrollTop <= 0;
      const atBottom = scrollRoot.scrollTop + window.innerHeight >= scrollRoot.scrollHeight - 1;
      const pullingDownAtTop = atTop && deltaY > 0;
      const pullingUpAtBottom = atBottom && deltaY < 0;

      if (pullingDownAtTop || pullingUpAtBottom) {
        event.preventDefault();
      }
    },
    { passive: false }
  );
}

function bindLaunchQueueConsumer() {
  if (!("launchQueue" in window) || typeof window.launchQueue?.setConsumer !== "function") return;

  window.launchQueue.setConsumer(launchParams => {
    const target = launchParams?.targetURL;
    if (!target) return;
    handleIncomingTargetUrl(String(target));
  });
}

function injectButtonIcons() {
  if (els.pasteButton) {
    els.pasteButton.innerHTML = `<span class="button-icon">${SVG_ICONS.paste}</span>`;
  }

  if (els.clearButton) {
    els.clearButton.innerHTML = `<span class="button-icon">${SVG_ICONS.clear}</span>`;
  }

  if (els.copyPrimaryButton) {
    els.copyPrimaryButton.innerHTML = `<span class="button-icon">${SVG_ICONS.copy}</span>`;
  }

  if (els.sharePrimaryButton) {
    els.sharePrimaryButton.innerHTML = `<span class="button-icon">${SVG_ICONS.share}</span>`;
  }

  if (els.copyOriginalButton) {
    els.copyOriginalButton.innerHTML = `<span class="button-icon">${SVG_ICONS.unlink}</span>`;
  }

  if (els.themeToggle) {
    syncThemeToggleIcon();
  }

  if (els.searchModeButton) {
    els.searchModeButton.innerHTML = `<span class="button-icon">${SVG_ICONS.search}</span>`;
  }

  if (els.recentSwapsButton) {
    els.recentSwapsButton.innerHTML = `<span class="button-icon">${SVG_ICONS.history}</span>`;
  }

  if (els.useSampleButton) {
    els.useSampleButton.innerHTML = `<span class="button-icon">${SVG_ICONS.shuffle}</span>`;
  }

  syncSearchModeUI();
}

function isIosDevice() {
  const userAgent = navigator.userAgent || "";
  return /iP(ad|hone|od)/.test(userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function initIOSInstallPrompt() {
  if (!els.iosInstallCta) return;

  const shouldShowPrompt = isIosDevice() && !isInStandaloneMode();
  els.iosInstallCta.classList.toggle("hidden", !shouldShowPrompt);
}

function lockPageScroll(className) {
  if (className) {
    document.body.classList.add(className);
  }

  if (state.modalScrollLockDepth === 0) {
    state.lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.overflow = "hidden";
  }

  state.modalScrollLockDepth += 1;
}

function unlockPageScroll(className) {
  if (className) {
    document.body.classList.remove(className);
  }

  if (state.modalScrollLockDepth <= 0) return;
  state.modalScrollLockDepth -= 1;
  if (state.modalScrollLockDepth > 0) return;

  document.body.style.overflow = "";
  const restoreY = state.lockedScrollY || 0;
  if (Math.abs(window.scrollY - restoreY) > 1) {
    window.scrollTo(0, restoreY);
  }
}

function openIOSInstallModal() {
  if (!els.iosInstallModal || state.isIOSInstallModalOpen) return;
  if (state.iosInstallModalHideTimer) {
    clearTimeout(state.iosInstallModalHideTimer);
    state.iosInstallModalHideTimer = null;
  }
  state.isIOSInstallModalOpen = true;
  els.iosInstallModal.classList.remove("hidden");
  requestAnimationFrame(() => {
    els.iosInstallModal?.classList.add("is-open");
  });
  els.iosInstallModal.setAttribute("aria-hidden", "false");
  lockPageScroll("ios-install-modal-open");
}

function closeIOSInstallModal() {
  if (!els.iosInstallModal || !state.isIOSInstallModalOpen) return;
  state.isIOSInstallModalOpen = false;
  els.iosInstallModal.classList.remove("is-open");
  els.iosInstallModal.setAttribute("aria-hidden", "true");
  unlockPageScroll("ios-install-modal-open");
  state.iosInstallModalHideTimer = setTimeout(() => {
    els.iosInstallModal?.classList.add("hidden");
    state.iosInstallModalHideTimer = null;
  }, 240);
}

function openRecentSwapsModal() {
  if (!els.recentSwapsModal || state.isRecentSwapsModalOpen) return;
  if (state.recentSwapsModalHideTimer) {
    clearTimeout(state.recentSwapsModalHideTimer);
    state.recentSwapsModalHideTimer = null;
  }
  renderRecentSwaps();
  state.isRecentSwapsModalOpen = true;
  els.recentSwapsButton?.classList.add("is-active");
  els.recentSwapsModal.classList.remove("hidden");
  requestAnimationFrame(() => {
    els.recentSwapsModal?.classList.add("is-open");
  });
  els.recentSwapsModal.setAttribute("aria-hidden", "false");
  lockPageScroll("recent-swaps-modal-open");
}

function closeRecentSwapsModal() {
  if (!els.recentSwapsModal || !state.isRecentSwapsModalOpen) return;
  state.isRecentSwapsModalOpen = false;
  els.recentSwapsButton?.classList.remove("is-active");
  els.recentSwapsModal.classList.remove("is-open");
  els.recentSwapsModal.setAttribute("aria-hidden", "true");
  unlockPageScroll("recent-swaps-modal-open");
  state.recentSwapsModalHideTimer = setTimeout(() => {
    els.recentSwapsModal?.classList.add("hidden");
    state.recentSwapsModalHideTimer = null;
  }, 240);
}

function getLegalContent() {
  return LEGAL_CONTENT[state.currentLanguage] || LEGAL_CONTENT["pt-br"];
}

function renderLegalModalContent(type = "privacy") {
  const content = getLegalContent();
  if (!els.legalModalTitle || !els.legalModalBody) return;
  const isPrivacy = type === "privacy";
  els.legalModalTitle.textContent = isPrivacy ? content.privacyTitle : content.termsTitle;
  els.legalModalBody.innerHTML = isPrivacy ? content.privacyHtml : content.termsHtml;
}

function openLegalModal(type = "privacy") {
  if (!els.legalModal) return;
  if (state.isLegalModalOpen) {
    state.activeLegalType = type;
    renderLegalModalContent(type);
    return;
  }
  state.activeLegalType = type;
  if (state.legalModalHideTimer) {
    clearTimeout(state.legalModalHideTimer);
    state.legalModalHideTimer = null;
  }
  renderLegalModalContent(type);
  state.isLegalModalOpen = true;
  els.legalModal.classList.remove("hidden");
  requestAnimationFrame(() => {
    els.legalModal?.classList.add("is-open");
  });
  els.legalModal.setAttribute("aria-hidden", "false");
  lockPageScroll("legal-modal-open");
  if (els.legalModalBody) {
    els.legalModalBody.scrollTop = 0;
  }
}

function closeLegalModal() {
  if (!els.legalModal || !state.isLegalModalOpen) return;
  state.isLegalModalOpen = false;
  els.legalModal.classList.remove("is-open");
  els.legalModal.setAttribute("aria-hidden", "true");
  unlockPageScroll("legal-modal-open");
  state.legalModalHideTimer = setTimeout(() => {
    els.legalModal?.classList.add("hidden");
    state.legalModalHideTimer = null;
  }, 240);
}

function bindEvents() {
  els.themeToggle?.addEventListener("click", toggleTheme);
  els.languageToggle?.addEventListener("click", event => {
    event.stopPropagation();
    if (state.isLanguageMenuOpen) closeLanguageMenu();
    else openLanguageMenu();
  });
  document.addEventListener("click", event => {
    if (!els.languageMenu?.contains(event.target)) {
      closeLanguageMenu();
    }
  });

  els.iosInstallCta?.addEventListener("click", () => {
    openIOSInstallModal();
  });

  els.iosInstallClose?.addEventListener("click", () => {
    closeIOSInstallModal();
  });

  els.iosInstallBackdrop?.addEventListener("click", () => {
    closeIOSInstallModal();
  });

  els.recentSwapsButton?.addEventListener("click", event => {
    pulseActionButton(event.currentTarget, "toggle");
    openRecentSwapsModal();
  });

  els.recentSwapsClose?.addEventListener("click", () => {
    closeRecentSwapsModal();
  });

  els.recentSwapsBackdrop?.addEventListener("click", () => {
    closeRecentSwapsModal();
  });
  els.privacyPolicyButton?.addEventListener("click", () => {
    openLegalModal("privacy");
  });
  els.termsOfUseButton?.addEventListener("click", () => {
    openLegalModal("terms");
  });
  els.legalClose?.addEventListener("click", () => {
    closeLegalModal();
  });
  els.legalBackdrop?.addEventListener("click", () => {
    closeLegalModal();
  });

  els.clearRecentSwapsButton?.addEventListener("click", event => {
    if (!state.recentSwaps.length) return;
    state.recentSwaps = [];
    persistRecentSwaps();
    renderRecentSwaps();
    pulseActionButton(event.currentTarget);
    triggerHaptic("light");
    showFloatingToast("histórico removido.");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.isLanguageMenuOpen) {
      closeLanguageMenu();
      return;
    }

    if (event.key === "Escape" && state.isIOSInstallModalOpen) {
      closeIOSInstallModal();
      return;
    }

    if (event.key === "Escape" && state.isRecentSwapsModalOpen) {
      closeRecentSwapsModal();
      return;
    }
    if (event.key === "Escape" && state.isLegalModalOpen) {
      closeLegalModal();
    }
  });

  els.convertButton?.addEventListener("click", () => {
    onConvert({ shouldScrollToStatus: true });
  });

  els.searchModeButton?.addEventListener("click", event => {
    state.isSearchMode = !state.isSearchMode;
    pulseActionButton(event.currentTarget, "toggle");
    syncSearchModeUI();

    if (state.isSearchMode) {
      if (els.input) {
        els.input.focus({ preventScroll: true });
        const valueLength = els.input.value?.length || 0;
        els.input.setSelectionRange(valueLength, valueLength);
      }
      showFloatingToast("modo pesquisa ativado.");
    } else {
      softlyDismissKeyboard();
    }
  });

  els.clearButton?.addEventListener("click", event => {
    pulseActionButton(event.currentTarget);
    resetForm({ announce: true });
  });

  els.resultDismissButton?.addEventListener("click", event => {
    pulseActionButton(event.currentTarget);
    resetForm();
  });

  els.pasteButton?.addEventListener("click", async () => {
    const pasted = await smartPasteIntoInput({ announce: true, autoConvert: true });

    pulseActionButton(els.pasteButton);

    if (!pasted) {
      els.input?.focus();
      showFloatingToast("toque e cole o link no campo.");
    }
  });

  els.useSampleButton?.addEventListener("click", event => {
    const randomSample = pickRandomSampleLink();
    state.shuffleInProgress = true;
    els.input.value = "sorteando um swap...";
    hideStatus();
    softlyDismissKeyboard();
    pulseActionButton(event.currentTarget);
    onConvert({ shouldScrollToStatus: true, forcedLink: randomSample, fromShuffle: true });
  });

  els.copyPrimaryButton?.addEventListener("click", async event => {
    if (!state.currentResult) return;
    const text = buildPrimaryLinksText(state.currentResult);
    if (!text) return;
    await copyText(text);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showFloatingToast(t("topCopied"));
  });

  els.sharePrimaryButton?.addEventListener("click", async event => {
    if (!state.currentResult) return;
    const text = buildPrimaryLinksText(state.currentResult);
    if (!text) return;

    const titleBits = [state.currentResult.artist, state.currentResult.title].filter(Boolean).join(" • ");

    if (navigator.share) {
      try {
        await navigator.share({
          title: titleBits || "music link swapper",
          text
        });
        pulseActionButton(event.currentTarget);
        triggerHaptic("light");
        showFloatingToast(t("topShared"));
        return;
      } catch (_error) {}
    }

    await copyText(text);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showFloatingToast(t("topCopied"));
  });

  els.copyOriginalButton?.addEventListener("click", async event => {
    if (!state.currentOriginalUrl) return;
    await copyText(state.currentOriginalUrl);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showFloatingToast(t("originalCopied"));
  });

  els.input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConvert({ shouldScrollToStatus: true });
    }
  });

  els.input?.addEventListener("paste", () => {
    setTimeout(async () => {
      hideStatus();
      softlyDismissKeyboard();
      if (isSupportedStreamingUrl(extractUrl(els.input.value.trim()) || "")) {
        await onConvert({ shouldScrollToStatus: true });
      }
    }, 110);
  });
}

function hydrateFromIncomingUrl() {
  const params = new URLSearchParams(window.location.search);
  const incomingUrl = resolveIncomingLink(params);

  if (incomingUrl) {
    els.input.value = incomingUrl;
    state.autoConvertedFromQuery = true;
    state.lastAutoUrl = incomingUrl;
    showStatus("link recebido automaticamente.", "success", { autoHide: true });

    requestAnimationFrame(() => {
      setTimeout(() => {
        onConvert({ shouldScrollToStatus: true });
      }, 100);
    });
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function handleIncomingTargetUrl(targetUrl) {
  if (!targetUrl) return;

  let incomingUrl = null;

  try {
    const parsed = new URL(targetUrl, window.location.origin);
    incomingUrl = resolveIncomingLink(parsed.searchParams);
  } catch (_error) {
    incomingUrl = parseUrlCandidate(targetUrl);
  }

  if (!incomingUrl) return;

  els.input.value = incomingUrl;
  state.autoConvertedFromQuery = true;
  state.lastAutoUrl = incomingUrl;
  showStatus("link recebido automaticamente.", "success", { autoHide: true });

  requestAnimationFrame(() => {
    setTimeout(() => {
      onConvert({ shouldScrollToStatus: true });
    }, 80);
  });
}

function resolveIncomingLink(params) {
  const candidateValues = [
    params.get("url"),
    params.get("link"),
    params.get("text")
  ];

  for (const candidate of candidateValues) {
    const parsed = parseUrlCandidate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function parseUrlCandidate(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;
  const value = rawValue.trim();
  if (!value) return null;

  const direct = extractUrl(value);
  if (direct && isSupportedStreamingUrl(direct)) return direct;

  const decoded = safeDecodeURIComponent(value);
  if (decoded && decoded !== value) {
    const normalizedDecoded = decoded.replace(/^web\+swapper:/i, "").trim();
    const decodedProtocolUrl = extractUrl(normalizedDecoded);
    if (decodedProtocolUrl && isSupportedStreamingUrl(decodedProtocolUrl)) return decodedProtocolUrl;

    const decodedUrl = extractUrl(decoded);
    if (decodedUrl && isSupportedStreamingUrl(decodedUrl)) return decodedUrl;
  }

  const protocolStripped = value.replace(/^web\+swapper:/i, "").trim();
  if (protocolStripped && protocolStripped !== value) {
    const protocolUrl = extractUrl(protocolStripped);
    if (protocolUrl && isSupportedStreamingUrl(protocolUrl)) return protocolUrl;
  }

  const prefixed = value.match(/^(?:url|link)[:=](.+)$/i)?.[1]?.trim();
  if (prefixed) {
    const prefixedUrl = extractUrl(prefixed);
    if (prefixedUrl && isSupportedStreamingUrl(prefixedUrl)) return prefixedUrl;
  }

  return null;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

async function tryAutoPasteFromClipboard() {
  if (els.input.value.trim()) return;
  if (!navigator.clipboard?.readText) return;

  try {
    const text = await navigator.clipboard.readText();
    const url = extractUrl(text);

    if (url && isSupportedStreamingUrl(url)) {
      els.input.value = url;
      state.lastClipboardText = typeof text === "string" ? text.trim() : "";
      state.lastAutoUrl = url;
      showStatus("link detectado no clipboard.", "success", { autoHide: true });
      setTimeout(() => onConvert({ shouldScrollToStatus: true }), 80);
    }
  } catch (_error) {}
}

async function smartPasteIntoInput({ announce = false, autoConvert = false } = {}) {
  const applyPastedText = value => {
    const url = extractUrl(value);
    if (!url) return false;
    els.input.value = url;
    els.input.dispatchEvent(new Event("input", { bubbles: true }));
    els.input.dispatchEvent(new Event("change", { bubbles: true }));
    state.lastClipboardText = typeof value === "string" ? value.trim() : "";
    state.lastAutoUrl = url;
    softlyDismissKeyboard();
    if (announce) showFloatingToast("link colado no campo.");
    if (autoConvert && isSupportedStreamingUrl(url)) {
      setTimeout(() => onConvert({ shouldScrollToStatus: true }), 60);
    }
    return true;
  };

  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (applyPastedText(text)) return true;
    }
  } catch (_error) {
    // fallback below
  }

  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (!item.types?.includes("text/plain")) continue;
        const blob = await item.getType("text/plain");
        const text = await blob.text();
        if (applyPastedText(text)) return true;
      }
    }
  } catch (_error) {
    // fallback below
  }

  const manual = window.prompt("Cole o link da música:");
  if (applyPastedText(manual || "")) {
    return true;
  }
  return false;
}

async function onConvert({ shouldScrollToStatus = false, forcedLink = "", fromShuffle = false } = {}) {
  const rawInput = els.input.value.trim();
  const link = forcedLink || extractUrl(rawInput);
  const shouldFallbackToLinkSwap = state.isSearchMode && !!link;
  const modeAtSubmit = state.isSearchMode && !shouldFallbackToLinkSwap;

  if (shouldFallbackToLinkSwap) {
    state.isSearchMode = false;
    syncSearchModeUI();
  }
  state.scrollAfterConvert = shouldScrollToStatus;

  if (modeAtSubmit) {
    if (!rawInput || rawInput.length < 3) {
      showStatus("digite artista + música para pesquisar.", "error");
      return;
    }
  } else {
    if (!link) {
      showStatus("cole um link válido para continuar.", "error");
      return;
    }

    if (!isSupportedStreamingUrl(link)) {
      showStatus("isso não parece um link de streaming suportado.", "error");
      return;
    }
  }

  softlyDismissKeyboard();
  setLoading(true);
  hideResult();
  showStatus(modeAtSubmit ? t("loadingSearch") : t("loadingSwap"), "default");
  startCoverShimmer();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        link,
        adapters: REQUESTED_ADAPTERS,
        queryMode: modeAtSubmit,
        query: modeAtSubmit ? rawInput : undefined
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.links)) {
      stopCoverShimmer();
      showStatus(
        payload?.error || "não consegui converter esse link agora. tente novamente em instantes.",
        "error"
      );
      return;
    }

    const result = normalizeApiPayload(payload.data, modeAtSubmit ? "" : link, modeAtSubmit);
    if (!result) {
      stopCoverShimmer();
      showStatus("não encontrei plataformas para esse link.", "error");
      return;
    }

    state.currentOriginalUrl = modeAtSubmit ? null : link;
    state.currentResult = result;
    renderResult(result);
    const directCount = result.links.filter(item => !item.isSearchResult).length;
    showStatus(directCount === 1 ? t("swapsFoundSingle") : tCount("swapsFoundPlural", directCount), "success");
    els.input.value = "";

    if (state.scrollAfterConvert) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          els.statusCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, state.autoConvertedFromQuery ? 40 : 100);
      });
    }
  } catch (_error) {
    stopCoverShimmer();
    showStatus("deu erro na conversão. tente novamente em instantes.", "error");
  } finally {
    if (fromShuffle && cleanText(els.input.value) === "sorteando um swap...") {
      els.input.value = "";
    }
    if (fromShuffle) {
      state.shuffleInProgress = false;
    }
    setLoading(false);
    state.autoConvertedFromQuery = false;
    state.scrollAfterConvert = false;
    if (modeAtSubmit) {
      state.isSearchMode = false;
      syncSearchModeUI();
    }
  }
}

function normalizeApiPayload(data, sourceLink = "", fromSearchMode = false) {
  const canonicalTitle = pickBestUiTitle(data?.groundTruth?.title, data.title, "música encontrada");
  const canonicalArtist = cleanText(data?.groundTruth?.artist || "");
  const rawDescription = cleanText(canonicalArtist || data.description || "");
  const preview = parsePreview(canonicalTitle, rawDescription, {
    forceArtist: canonicalArtist
  });
  const searchQuery = [preview.title, preview.artist].filter(Boolean).join(" ").trim();
  const links = normalizeLinks(data.links, sourceLink, searchQuery);
  if (!links.length) return null;
  const image = normalizeArtworkUrl(data.image || null);

  return {
    title: preview.title,
    artist: preview.artist,
    album: cleanText(data?.groundTruth?.album || preview.album || data.album || ""),
    image,
    universalLink: data.universalLink || null,
    confidence: data?.groundTruth?.trustAsCanonical ? "high" : "",
    originalUrl: sourceLink || "",
    fromSearchMode: !!fromSearchMode,
    links
  };
}

function normalizeArtworkUrl(url) {
  if (!url || typeof url !== "string") return null;

  let cleanImage = url.trim();

  if (cleanImage.includes("mzstatic.com")) {
    cleanImage = cleanImage.replace(/\/\d+x\d+[^/]*$/i, "/600x600bb.jpg");
  }

  return cleanImage;
}

function parsePreview(title, description, options = {}) {
  const forceArtist = cleanText(options?.forceArtist || "");
  const cleanTitleValue = pickBestUiTitle(title, "música encontrada");
  const cleanDescriptionValue = cleanText(description);
  if (forceArtist) {
    const cleanArtist = normalizeComparisonText(forceArtist) === normalizeComparisonText(cleanTitleValue) ? "" : forceArtist;
    return {
      title: cleanTitleValue,
      artist: cleanArtist,
      album: ""
    };
  }

  if (!cleanDescriptionValue) {
    return {
      title: cleanTitleValue,
      artist: "",
      album: ""
    };
  }

  const separators = [" - ", " – ", " • ", " | "];
  let parts = [cleanDescriptionValue];

  for (const separator of separators) {
    if (cleanDescriptionValue.includes(separator)) {
      parts = cleanDescriptionValue.split(separator).map(cleanText).filter(Boolean);
      break;
    }
  }

  const normalizedTitle = normalizeComparisonText(cleanTitleValue);

  let filtered = parts
    .map(part => stripLeadingTitleFromPart(part, cleanTitleValue))
    .filter(Boolean)
    .filter(part => {
      const normalizedPart = normalizeComparisonText(part);
      return normalizedPart && normalizedPart !== normalizedTitle;
    });

  if (!filtered.length) {
    const fallbackArtist = stripLeadingTitleFromPart(cleanDescriptionValue, cleanTitleValue);
    const normalizedFallback = normalizeComparisonText(fallbackArtist);

    if (normalizedFallback && normalizedFallback !== normalizedTitle) {
      filtered = [fallbackArtist];
    }
  }

  if (!filtered.length) {
    return {
      title: cleanTitleValue,
      artist: "",
      album: ""
    };
  }

  return {
    title: cleanTitleValue,
    artist:
      normalizeComparisonText(filtered[0] || "") === normalizeComparisonText(cleanTitleValue) ? "" : filtered[0] || "",
    album: filtered.slice(1).join(" • ")
  };
}

function stripLeadingTitleFromPart(part, title) {
  const cleanPart = cleanText(part);
  const cleanTitle = cleanText(title);

  if (!cleanPart || !cleanTitle) return cleanPart;

  const normalizedPart = normalizeComparisonText(cleanPart);
  const normalizedTitle = normalizeComparisonText(cleanTitle);

  if (!normalizedPart || !normalizedTitle) return cleanPart;
  if (normalizedPart === normalizedTitle) return "";

  const regex = new RegExp(`^${escapeRegex(cleanTitle)}(?:\\s*[-–•|:]\\s*|\\s+)`, "i");
  const stripped = cleanPart.replace(regex, "").trim();

  if (!stripped) return "";
  if (normalizeComparisonText(stripped) === normalizedTitle) return "";

  return stripped;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeComparisonText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|•–:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericUiLabel(value) {
  const normalized = normalizeComparisonText(value);
  if (!normalized) return false;
  return (
    normalized === "resultado por busca" ||
    normalized === "resultado de busca" ||
    normalized === "search result" ||
    normalized === "musica encontrada" ||
    normalized === "song found"
  );
}

function pickBestUiTitle(...candidates) {
  for (const candidate of candidates) {
    const clean = cleanText(candidate);
    if (!clean) continue;
    if (isGenericUiLabel(clean)) continue;
    return clean;
  }
  return "música encontrada";
}

function renderSupportedChips() {
  if (!els.supportedChips) return;

  els.supportedChips.innerHTML = SUPPORTED_PLATFORM_CHIPS
    .map(key => {
      const meta = PLATFORM_META[key];
      return `<span class="chip icon-chip icon-chip-${escapeHtml(key)}" title="${escapeHtml(meta.name)}" aria-label="${escapeHtml(meta.name)}">${meta.icon}</span>`;
    })
    .join("");
}

function renderResult(result, { skipSave = false } = {}) {
  clearTimeout(state.hideResultTimer);
  els.resultCard.classList.remove("hidden", "is-exiting");
  els.resultCard.classList.add("result-card-live");
  els.platformGroups.innerHTML = "";

  els.resultTitle.textContent = result.title || "resultado";
  els.resultMeta.textContent = buildMeta(result);

  if (result.artist) {
    els.resultDescription.textContent = result.artist;
    els.resultDescription.classList.remove("hidden");
  } else {
    els.resultDescription.classList.add("hidden");
    els.resultDescription.textContent = "";
  }

  if (result.image) {
    showCoverImage(result.image);
  } else {
    stopCoverShimmer();
    hideCoverImage();
  }

  const primaryText = buildPrimaryLinksText(result);
  if (primaryText) {
    els.copyPrimaryButton.classList.remove("hidden");
    els.sharePrimaryButton.classList.remove("hidden");
  } else {
    els.copyPrimaryButton.classList.add("hidden");
    els.sharePrimaryButton.classList.add("hidden");
  }

  if (state.currentOriginalUrl) {
    els.copyOriginalButton.classList.remove("hidden");
  } else {
    els.copyOriginalButton.classList.add("hidden");
  }

  const groups = ["primary", "others"];
  for (const groupName of groups) {
    const items = result.links.filter(item => getSectionGroup(item.section) === groupName);
    if (!items.length) continue;

    const section = document.createElement("section");
    section.className = "platform-group-section";

    const list = document.createElement("div");
    list.className = "platform-list";
    const isOutras = groupName === "others";
    const defaultVisible = 0;
    const collapsed = isOutras && items.length > 0;
    const visibleItems = collapsed ? [] : items;

    if (collapsed) {
      const controlsWrap = document.createElement("div");
      controlsWrap.className = "see-more-wrap";
      const expandButton = document.createElement("button");
      expandButton.type = "button";
      expandButton.className = "tiny-button see-more-button";
      expandButton.textContent = t("seeMore");
      list.style.maxHeight = "0px";
      list.style.opacity = "0";
      expandButton.addEventListener("click", event => {
        const expanded = list.classList.toggle("is-expanded");
        pulseActionButton(event.currentTarget);
        if (expanded) {
          items.forEach(item => list.appendChild(createPlatformItem(item)));
          requestAnimationFrame(() => {
            list.style.maxHeight = `${list.scrollHeight}px`;
            list.style.opacity = "1";
          });
          setTimeout(() => {
            if (list.classList.contains("is-expanded")) {
              list.style.maxHeight = "none";
            }
          }, 260);
          expandButton.textContent = t("seeLess");
        } else {
          const currentHeight = list.scrollHeight;
          list.style.maxHeight = `${currentHeight}px`;
          requestAnimationFrame(() => {
            list.style.maxHeight = "0px";
            list.style.opacity = "0";
          });
          setTimeout(() => {
            if (list.classList.contains("is-expanded")) return;
            const current = Array.from(list.children);
            current.forEach(node => node.remove());
          }, 240);
          expandButton.textContent = t("seeMore");
        }
      });
      controlsWrap.appendChild(expandButton);
      section.appendChild(controlsWrap);
    }

    if (!(groupName === "others" && collapsed)) {
      const title = document.createElement("p");
      title.className = "group-title";
      title.textContent = groupName === "primary" ? t("primarySection") : t("othersSection");
      section.appendChild(title);
    }

    visibleItems.forEach(item => list.appendChild(createPlatformItem(item)));
    section.appendChild(list);

    els.platformGroups.appendChild(section);
  }

  renderResultLegend();
  if (!skipSave) saveRecentSwap(result);
}

function getSectionGroup(sectionName = "") {
  const normalized = String(sectionName).toLowerCase();
  return normalized === "principais" || normalized === "main" || normalized === "primary"
    ? "primary"
    : "others";
}

function createPlatformItem(item) {
  const badgeClass = item.isSearchResult ? "is-not-found" : item.isVerified ? "is-verified" : "is-found";
  const badgeLabel = item.isSearchResult ? t("notLocated") : item.isVerified ? t("verified") : t("identified");
  const badgeIcon = item.isSearchResult ? SVG_ICONS.notLocated : item.isVerified ? SVG_ICONS.verified : SVG_ICONS.found;
  const openIcon = item.isSearchResult ? SVG_ICONS.search : SVG_ICONS.open;
  const openLabel = item.isSearchResult ? "buscar" : "abrir";

  const row = document.createElement("article");
  row.className = "platform-item";

  row.innerHTML = `
    <div class="platform-icon platform-icon-${escapeHtml(item.key)}">${item.icon}</div>
    <div class="platform-copy">
      <div class="platform-name-row">
        <div class="platform-name">${escapeHtml(item.name)}</div>
        <div class="platform-badge ${badgeClass}" aria-label="${badgeLabel}">
          ${badgeIcon}
        </div>
      </div>
    </div>
    <div class="platform-actions">
      <button class="mini-action copy" type="button" data-action="copy" aria-label="copiar" title="copiar">
        <span class="button-icon">${SVG_ICONS.copy}</span>
      </button>
      <button class="mini-action share" type="button" data-action="share" aria-label="compartilhar" title="compartilhar">
        <span class="button-icon">${SVG_ICONS.share}</span>
      </button>
      <button class="mini-action open" type="button" data-action="open" aria-label="${openLabel}" title="${openLabel}">
        <span class="button-icon">${openIcon}</span>
      </button>
    </div>
  `;

  row.querySelector('[data-action="copy"]').addEventListener("click", async event => {
    await copyText(item.url);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showInlineToast(row, `${item.name} ${t("copiedSuffix")}`);
  });

  row.querySelector('[data-action="share"]').addEventListener("click", async event => {
    const shared = await shareLink(item);
    pulseActionButton(event.currentTarget);
    triggerHaptic(shared ? "light" : "medium");

    if (shared) {
      showInlineToast(row, `${item.name} ${t("sharedSuffix")}`);
    } else {
      await copyText(item.url);
      showInlineToast(row, `${item.name} ${t("copiedSuffix")}`);
    }
  });

  row.querySelector('[data-action="open"]').addEventListener("click", event => {
    pulseActionButton(event.currentTarget, "open");
    triggerHaptic("light");
    openPlatformUrl(item);
  });

  return row;
}

function pulseActionButton(button, variant = "copy") {
  if (!button) return;

  const pressedClass = variant === "open" ? "is-pressed-open" : "is-pressed-copy";
  const resetTimers = state.activeButtonResetTimers;
  const previousTimer = resetTimers.get(button);

  if (previousTimer) {
    clearTimeout(previousTimer);
  }

  button.classList.remove("is-pressed-copy", "is-pressed-open");
  void button.offsetWidth;
  button.classList.add(pressedClass);

  const timeoutMs = variant === "open" ? 320 : variant === "toggle" ? 150 : 1000;
  const timer = setTimeout(() => {
    button.classList.remove(pressedClass);
    resetTimers.delete(button);
  }, timeoutMs);

  resetTimers.set(button, timer);
}

function triggerHaptic(kind = "light") {
  try {
    if (navigator.vibrate) {
      const pattern = kind === "heavy" ? [20] : kind === "medium" ? [14] : [8];
      navigator.vibrate(pattern);
    }
  } catch (_error) {}
}

async function shareLink(item) {
  const titleBits = [state.currentResult?.artist, state.currentResult?.title].filter(Boolean).join(" • ");
  const shareTitle = titleBits || item.name;
  const shareText = [shareTitle, "", item.url].filter(Boolean).join("\n");

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: item.url
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  return false;
}

function openPlatformUrl(item) {
  const url = item?.url;
  if (!url) return;

  const scheme = item.appScheme;
  if (scheme && isMobileDevice()) {
    const fallback = url;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = buildDeepLinkUrl(url, scheme);
    document.body.appendChild(iframe);

    setTimeout(() => {
      iframe.remove();
      window.open(fallback, "_blank", "noopener,noreferrer");
    }, 700);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function buildDeepLinkUrl(url, scheme) {
  try {
    const parsed = new URL(url);
    return `${scheme}${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch (_error) {
    return url;
  }
}

function isMobileDevice() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent || "");
}

function startCoverShimmer() {
  if (!els.coverWrap || !els.coverShimmer) return;
  els.coverWrap.classList.remove("hidden");
  els.coverShimmer.classList.remove("hidden");
  els.coverImage.classList.add("hidden");
  els.coverImage.removeAttribute("src");
}

function stopCoverShimmer() {
  els.coverShimmer?.classList.add("hidden");
}

function hideCoverImage() {
  els.coverWrap?.classList.add("hidden");
  els.coverImage?.classList.add("hidden");
  els.coverImage?.removeAttribute("src");
}

function showCoverImage(src) {
  if (!els.coverWrap || !els.coverImage) return;

  els.coverWrap.classList.remove("hidden");
  els.coverShimmer.classList.remove("hidden");
  els.coverImage.classList.add("hidden");

  const img = new Image();
  img.onload = () => {
    els.coverImage.src = src;
    els.coverImage.classList.remove("hidden");
    stopCoverShimmer();
  };
  img.onerror = () => {
    hideCoverImage();
    stopCoverShimmer();
  };
  img.src = src;
}

function showInlineToast(_container, message) {
  showFloatingToast(message);
}

function hydrateRecentSwaps() {
  state.recentSwaps = loadRecentSwaps();
}

function loadRecentSwaps() {
  try {
    const raw = localStorage.getItem(RECENT_SWAPS_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item === "object")
      .slice(0, MAX_RECENT_SWAPS);
  } catch (_error) {
    return [];
  }
}

function persistRecentSwaps() {
  try {
    localStorage.setItem(RECENT_SWAPS_STORAGE_KEY, JSON.stringify(state.recentSwaps.slice(0, MAX_RECENT_SWAPS)));
  } catch (_error) {}
}

function saveRecentSwap(result) {
  if (!result || !result.title) return;
  const originalUrl = cleanText(result.originalUrl || state.currentOriginalUrl || "");
  const sourceKey = detectPlatformKeyFromUrl(originalUrl);
  const sourceMeta = sourceKey ? PLATFORM_META[sourceKey] : null;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: cleanText(result.title),
    artist: cleanText(result.artist || ""),
    album: cleanText(result.album || ""),
    image: cleanText(result.image || ""),
    originalUrl,
    isManualSearch: !!result.fromSearchMode,
    queryText: cleanText([result.artist, result.title].filter(Boolean).join(" ")),
    sourceKey: sourceKey || "",
    sourceName: sourceMeta?.name || "fonte",
    savedAt: Date.now()
  };

  const normalizedNewUrl = normalizeComparisonText(originalUrl);
  const normalizedTrack = normalizeComparisonText(`${entry.artist} ${entry.title}`);
  const deduped = state.recentSwaps.filter(item => {
    const itemUrl = normalizeComparisonText(item.originalUrl || "");
    const itemTrack = normalizeComparisonText(`${item.artist || ""} ${item.title || ""}`);
    if (normalizedNewUrl && itemUrl && itemUrl === normalizedNewUrl) return false;
    if (!normalizedNewUrl && normalizedTrack && itemTrack === normalizedTrack) return false;
    return true;
  });

  state.recentSwaps = [entry, ...deduped].slice(0, MAX_RECENT_SWAPS);
  persistRecentSwaps();
  if (state.isRecentSwapsModalOpen) {
    renderRecentSwaps();
  }
}

function detectPlatformKeyFromUrl(url) {
  const lower = String(url || "").toLowerCase();
  if (!lower) return "";
  if (lower.includes("music.apple.com")) return "appleMusic";
  if (lower.includes("spotify")) return "spotify";
  if (lower.includes("music.youtube.com")) return "youtubeMusic";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("deezer.com")) return "deezer";
  if (lower.includes("soundcloud.com")) return "soundCloud";
  if (lower.includes("tidal.com")) return "tidal";
  if (lower.includes("qobuz.com")) return "qobuz";
  if (lower.includes("bandcamp.com")) return "bandcamp";
  return "";
}

function renderRecentSwaps() {
  if (!els.recentSwapsList) return;
  const swapCount = state.recentSwaps.length;
  if (els.recentSwapsTitle) {
    els.recentSwapsTitle.textContent = swapCount === 1 ? t("latestSwap").toUpperCase() : t("recentSwaps").toUpperCase();
  }
  if (els.clearRecentSwapsButton) {
    els.clearRecentSwapsButton.classList.toggle("hidden", swapCount === 0);
    const label = els.clearRecentSwapsButton.querySelector("span:last-child");
    if (label) {
      label.textContent = swapCount === 1 ? t("clearSwap") : t("clearSwaps");
    }
  }

  if (!state.recentSwaps.length) {
    els.recentSwapsList.innerHTML = `<p class="recent-empty">${escapeHtml(t("noRecentSwaps"))}</p>`;
    return;
  }

  els.recentSwapsList.innerHTML = "";
  state.recentSwaps.forEach(item => {
    const card = document.createElement("article");
    card.className = "recent-swap-card";
    const sourceIcon = item.sourceKey ? PLATFORM_META[item.sourceKey]?.icon : "";
    const safeTitle = escapeHtml(item.title || "faixa");
    const safeArtist = escapeHtml(item.artist || "artista desconhecido");
    const safeImage = escapeHtml(item.image || "");
    const sourceName = escapeHtml(item.sourceName || "fonte");
    const shouldShowSource = !item.isManualSearch && !!sourceIcon;
    const shouldShowCopy = !item.isManualSearch && !!item.originalUrl;

    card.innerHTML = `
      <div class="recent-swap-cover-wrap">
        ${safeImage ? `<img class="recent-swap-cover" src="${safeImage}" alt="capa de ${safeTitle}" loading="lazy" />` : `<div class="recent-swap-cover is-placeholder"></div>`}
      </div>
      <div class="recent-swap-copy">
        <p class="recent-swap-artist">${safeArtist}</p>
        <p class="recent-swap-title">${safeTitle}</p>
      </div>
      ${shouldShowSource ? `<div class="recent-swap-source" title="${sourceName}" aria-label="${sourceName}">${sourceIcon}</div>` : `<div class="recent-swap-source hidden" aria-hidden="true"></div>`}
      <div class="recent-swap-actions">
        <button class="mini-action copy ${shouldShowCopy ? "" : "hidden"}" type="button" data-action="copy" aria-label="copiar link" title="copiar link">
          <span class="button-icon">${SVG_ICONS.link}</span>
        </button>
        <button class="mini-action open" type="button" data-action="swap" aria-label="refazer swap" title="refazer swap">
          <span class="button-icon">${SVG_ICONS.search}</span>
        </button>
      </div>
    `;

    card.querySelector('[data-action="copy"]')?.addEventListener("click", async event => {
      if (!item.originalUrl) return;
      await copyText(item.originalUrl);
      pulseActionButton(event.currentTarget);
      showFloatingToast(t("linkCopied"));
    });

    card.querySelector('[data-action="swap"]')?.addEventListener("click", event => {
      pulseActionButton(event.currentTarget, "open");
      closeRecentSwapsModal();
      if (item.originalUrl) {
        els.input.value = item.originalUrl;
        onConvert({ shouldScrollToStatus: true, forcedLink: item.originalUrl });
        return;
      }

      if (item.queryText) {
        state.isSearchMode = true;
        syncSearchModeUI();
        els.input.value = item.queryText;
        onConvert({ shouldScrollToStatus: true });
      }
    });

    els.recentSwapsList.appendChild(card);
  });
}

function softlyDismissKeyboard() {
  try {
    els.input.blur();
    document.activeElement?.blur?.();
  } catch (_error) {}
}

function hideResult() {
  clearTimeout(state.hideResultTimer);

  if (!els.resultCard.classList.contains("hidden")) {
    els.resultCard.classList.remove("result-card-live");
    els.resultCard.classList.add("is-exiting");
    state.hideResultTimer = setTimeout(() => {
      els.platformGroups.innerHTML = "";
      els.copyPrimaryButton.classList.add("hidden");
      els.sharePrimaryButton.classList.add("hidden");
      els.copyOriginalButton.classList.add("hidden");
      els.resultLegend?.classList.add("hidden");
      if (els.resultLegend) els.resultLegend.innerHTML = "";
      hideCoverImage();
      els.resultCard.classList.remove("is-exiting");
      els.resultCard.classList.add("hidden");
    }, 220);
    return;
  }

  els.platformGroups.innerHTML = "";
  els.copyPrimaryButton.classList.add("hidden");
  els.sharePrimaryButton.classList.add("hidden");
  els.copyOriginalButton.classList.add("hidden");
  els.resultLegend?.classList.add("hidden");
  if (els.resultLegend) els.resultLegend.innerHTML = "";
  hideCoverImage();
}

function showStatus(message, tone = "default", { autoHide = false } = {}) {
  clearTimeout(state.statusHideTimer);
  els.statusCard.textContent = message;
  els.statusCard.classList.remove("hidden", "is-error", "is-success", "status-card-live");
  if (tone === "error") els.statusCard.classList.add("is-error");
  if (tone === "success") els.statusCard.classList.add("is-success");
  void els.statusCard.offsetWidth;
  els.statusCard.classList.add("status-card-live");

  if (autoHide) {
    state.statusHideTimer = setTimeout(() => {
      hideStatus();
    }, 2200);
  }
}

function hideStatus() {
  clearTimeout(state.statusHideTimer);
  els.statusCard.classList.remove("status-card-live");
  els.statusCard.classList.add("hidden");
}

function showFloatingToast(message) {
  if (!els.floatingToast) return;

  clearTimeout(state.floatingToastTimer);
  clearTimeout(state.floatingToastHideTimer);
  els.floatingToast.textContent = message;
  els.floatingToast.classList.remove("hidden", "show");

  requestAnimationFrame(() => {
    els.floatingToast.classList.add("show");
  });

  state.floatingToastTimer = setTimeout(() => {
    els.floatingToast.classList.remove("show");
    state.floatingToastHideTimer = setTimeout(() => {
      els.floatingToast.classList.add("hidden");
      state.floatingToastHideTimer = null;
    }, 260);
  }, 2050);
}

function setLoading(loading) {
  els.convertButton.disabled = loading;
  if (loading) {
    els.convertButton.textContent = state.isSearchMode ? t("loadingSearch") : t("loadingSwap");
    return;
  }
  updateConvertButtonLabel();
}

function updateConvertButtonLabel() {
  if (!els.convertButton) return;
  if (state.isSearchMode) {
    els.convertButton.textContent = t("search");
    return;
  }

  els.convertButton.innerHTML = `<span>${escapeHtml(t("swap"))}</span><span class="button-icon swap-button-icon">${SVG_ICONS.swap}</span>`;
}

function pickRandomSampleLink() {
  const index = Math.floor(Math.random() * SAMPLE_LINKS.length);
  return SAMPLE_LINKS[index];
}

function resetForm({ announce = false } = {}) {
  els.input.value = "";
  softlyDismissKeyboard();
  hideStatus();
  hideResult();
  stopCoverShimmer();
  state.currentResult = null;
  state.currentOriginalUrl = null;
  state.autoConvertedFromQuery = false;
  state.lastAutoUrl = "";
  state.isSearchMode = false;
  syncSearchModeUI();

  if (announce) {
    showFloatingToast("campo de busca apagado.");
  }
}

function syncSearchModeUI() {
  if (els.searchModeButton) {
    els.searchModeButton.classList.toggle("is-active", state.isSearchMode);
  }
  if (els.inputLabel) {
    els.inputLabel.textContent = state.isSearchMode ? t("searchLabel") : t("linkLabel");
  }
  if (els.input) {
    els.input.type = state.isSearchMode ? "text" : "url";
    els.input.setAttribute("inputmode", state.isSearchMode ? "search" : "url");
    els.input.placeholder = state.isSearchMode
      ? t("searchPlaceholder")
      : t("linkPlaceholder");
  }
  setLoading(false);
}

function renderResultLegend() {
  if (!els.resultLegend) return;
  els.resultLegend.classList.remove("hidden");
  els.resultPoweredBy?.classList.remove("hidden");
  els.resultLegend.innerHTML = `
    <span class="legend-item"><span class="legend-icon is-verified">${SVG_ICONS.verified}</span> ${t("verified")}</span>
    <span class="legend-item"><span class="legend-icon is-found">${SVG_ICONS.found}</span> ${t("identified")}</span>
    <span class="legend-item"><span class="legend-icon is-not-found">${SVG_ICONS.notLocated}</span> ${t("notLocated")}</span>
  `;
}

function normalizeLinks(links, sourceLink = "", searchQuery = "") {
  const byType = new Map();

  for (const item of links) {
    if (!item || !item.url || item.notAvailable) continue;

    let type = normalizePlatformKey(item.type);
    if (IGNORED_PLATFORM_KEYS.has(String(type || "").toLowerCase())) continue;
    const meta = PLATFORM_META[type] || {
      name: prettifyPlatform(type),
      icon: "•",
      section: "outras",
      order: 999,
      isPrimaryCopy: false,
      appScheme: null
    };

    const isSearchResult = isSearchUrlForPlatform(type, item.url);
    const candidate = {
      key: type,
      name: meta.name,
      icon: meta.icon,
      section: meta.section,
      order: meta.order,
      url: item.url,
      isVerified: !!item.isVerified && !isSearchResult,
      isSearchResult,
      isPrimaryCopy: !!meta.isPrimaryCopy,
      appScheme: meta.appScheme || null
    };
    const existing = byType.get(type);
    if (!existing || scoreUiLinkQuality(candidate) > scoreUiLinkQuality(existing)) {
      byType.set(type, candidate);
    }
  }

  const normalized = Array.from(byType.values());
  addSearchFallbackLinks(normalized, byType, searchQuery);

  normalized.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.isSearchResult && !b.isSearchResult) return 1;
    if (!a.isSearchResult && b.isSearchResult) return -1;
    if (a.isVerified && !b.isVerified) return -1;
    if (!a.isVerified && b.isVerified) return 1;
    return a.name.localeCompare(b.name);
  });

  return normalized;
}

function addSearchFallbackLinks(normalized, byType, searchQuery) {
  const fallbackTypes = ["spotify", "appleMusic", "youtubeMusic", "youtube", "deezer", "soundCloud", "tidal", "qobuz", "amazonMusic"];
  const effectiveQuery = cleanText(searchQuery);
  if (!effectiveQuery) return;

  for (const type of fallbackTypes) {
    const existing = byType.get(type);
    if (existing && !existing.isSearchResult) continue;

    const searchUrl = buildSearchUrlForPlatform(type, effectiveQuery);
    if (!searchUrl) continue;

    const meta = PLATFORM_META[type] || {
      name: prettifyPlatform(type),
      icon: "•",
      section: "outras",
      order: 999,
      isPrimaryCopy: false,
      appScheme: null
    };

    const fallbackItem = {
      key: type,
      name: meta.name,
      icon: meta.icon,
      section: meta.section,
      order: meta.order,
      url: searchUrl,
      isVerified: false,
      isSearchResult: true,
      isPrimaryCopy: !!meta.isPrimaryCopy,
      appScheme: meta.appScheme || null
    };
    if (!existing || scoreUiLinkQuality(fallbackItem) > scoreUiLinkQuality(existing)) {
      if (existing) {
        const index = normalized.findIndex(item => item.key === type);
        if (index !== -1) normalized[index] = fallbackItem;
      } else {
        normalized.push(fallbackItem);
      }
      byType.set(type, fallbackItem);
    }
  }
}

function scoreUiLinkQuality(item) {
  if (!item) return -1;
  let score = 0;
  if (!item.isSearchResult) score += 20;
  if (item.isVerified) score += 20;
  if ((item.key === "youtube" || item.key === "youtubeMusic") && /[?&]v=/.test(String(item.url || ""))) score += 8;
  if (item.key === "appleMusic" && String(item.url || "").includes("?i=")) score += 10;
  return score;
}

function buildSearchUrlForPlatform(type, query) {
  const encoded = encodeURIComponent(query);

  if (type === "youtubeMusic") return `https://music.youtube.com/search?q=${encoded}`;
  if (type === "spotify") return `https://open.spotify.com/search/${encoded}`;
  if (type === "appleMusic") return `https://music.apple.com/br/search?term=${encoded}`;
  if (type === "youtube") return `https://www.youtube.com/results?search_query=${encoded}`;
  if (type === "deezer") return `https://www.deezer.com/search/${encoded}`;
  if (type === "soundCloud") return `https://soundcloud.com/search?q=${encoded}`;
  if (type === "tidal") return `https://listen.tidal.com/search?q=${encoded}`;
  if (type === "qobuz") return `https://www.qobuz.com/us-en/search?query=${encoded}`;
  if (type === "amazonMusic") return `https://music.amazon.com/search/${encoded}`;

  return "";
}

function isSearchUrlForPlatform(type, url) {
  const lower = String(url || "").toLowerCase();
  if (!lower) return false;

  if (type === "youtube") return lower.includes("/results?search_query=");
  if (type === "spotify") return lower.includes("open.spotify.com/search");
  if (type === "youtubeMusic") return lower.includes("music.youtube.com/search");
  if (type === "deezer") return lower.includes("deezer.com/search");
  if (type === "soundCloud") return lower.includes("soundcloud.com/search");
  if (type === "tidal") return lower.includes("tidal.com/search");
  if (type === "qobuz") return lower.includes("qobuz.com/") && lower.includes("/search");
  if (type === "amazonMusic") return lower.includes("music.amazon.com/search");
  if (type === "appleMusic" || type === "itunes") {
    return lower.includes("music.apple.com") && lower.includes("/search");
  }

  return /[?&](q|query|search_query|term)=/.test(lower) && lower.includes("search");
}

function isYouTubeMusicUrl(url) {
  return String(url || "").toLowerCase().includes("music.youtube.com");
}

function normalizePlatformKey(key) {
  if (!key) return "";
  const raw = String(key);
  const normalized = raw.toLowerCase();
  if (normalized === "youtubemusic") return "youtubeMusic";
  if (normalized === "youtube") return "youtube";
  if (normalized === "soundcloud") return "soundCloud";
  if (normalized === "amazonstore") return "amazonStore";
  if (normalized === "amazon" || normalized === "amazonmusic") return "amazonMusic";
  if (normalized === "apple" || normalized === "itunes") return "itunes";
  return raw;
}

function prettifyPlatform(key) {
  return String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
}

function buildMeta(result) {
  const pieces = [];
  if (result.album) pieces.push(result.album);
  return pieces.join(" • ");
}

function buildPrimaryLinksText(result) {
  const items = result.links.filter(item => item.isPrimaryCopy && !item.isSearchResult);
  if (!items.length) return "";

  const lines = [];
  const heading = [result.artist, result.title].filter(Boolean).join("\n");
  if (heading) lines.push(heading);
  lines.push("");

  items.forEach((item, index) => {
    lines.push(`${item.name}: ${item.url}`);
    if (index < items.length - 1) lines.push("");
  });

  return lines.join("\n").trim();
}

function extractUrl(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const direct = trimmed.match(/^https?:\/\/\S+$/i);
  if (direct) return direct[0];
  const embedded = trimmed.match(/https?:\/\/[^\s]+/i);
  if (embedded) return embedded[0];
  return null;
}

function isSupportedStreamingUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return STREAMING_HOST_HINTS.some(hint => lower.includes(hint));
}

function cleanText(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();
}


function getPreferredTheme() {
  const persisted = localStorage.getItem("mls-theme");
  if (persisted === "light" || persisted === "dark") return persisted;

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function initTheme() {
  applyTheme(getPreferredTheme(), { persist: false });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "light" ? "dark" : "light");
}

function getThemeChromeColor(theme) {
  return theme === "dark" ? "#0b0b0d" : "#f7f8fb";
}

function applyTheme(theme, { persist = true } = {}) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.classList.add("theme-switching");
  if (state.themeSwitchTimer) {
    clearTimeout(state.themeSwitchTimer);
  }
  document.documentElement.setAttribute("data-theme", normalized);
  syncThemeToggleIcon();

  if (persist) {
    localStorage.setItem("mls-theme", normalized);
  }

  window.dispatchEvent(new CustomEvent("mls-theme-change", { detail: { theme: normalized } }));
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", getThemeChromeColor(normalized));
  }

  state.themeSwitchTimer = setTimeout(() => {
    document.documentElement.classList.remove("theme-switching");
    state.themeSwitchTimer = null;
  }, 220);
}

function syncThemeToggleIcon() {
  if (!els.themeToggle) return;

  const current = document.documentElement.getAttribute("data-theme") || "light";
  const isLight = current === "light";
  els.themeToggle.classList.add("is-switching");
  els.themeToggle.innerHTML = `<span class="button-icon">${isLight ? SVG_ICONS.moon : SVG_ICONS.sun}</span>`;
  els.themeToggle.setAttribute("aria-label", isLight ? t("activateDark") : t("activateLight"));
  els.themeToggle.setAttribute("title", isLight ? t("themeDark") : t("themeLight"));

  setTimeout(() => {
    els.themeToggle?.classList.remove("is-switching");
  }, 220);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
