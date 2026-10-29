/**
 * Basic UI translations: English (source), Français, 日本語, Português (Brasil), Deutsch, Español.
 * The UI is written in English; text nodes whose exact text is in the dictionary are swapped in place
 * (the English original is remembered so switching back works). Dynamic sentences stay English.
 */
export type Lang = 'en' | 'fr' | 'ja' | 'pt' | 'de' | 'es';

export const LANGS: { code: Lang; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'pt', name: 'Português (BR)', flag: '🇧🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

// [en, fr, ja, pt, de, es]
const T: [string, string, string, string, string, string][] = [
  ['Play', 'Jouer', 'プレイ', 'Jogar', 'Spielen', 'Jugar'],
  ['Garage', 'Garage', 'ガレージ', 'Garagem', 'Garage', 'Garaje'],
  ['Shop', 'Boutique', 'ショップ', 'Loja', 'Shop', 'Tienda'],
  ['Missions', 'Missions', 'ミッション', 'Missões', 'Missionen', 'Misiones'],
  ['Daily', 'Jour', 'デイリー', 'Diário', 'Täglich', 'Diario'],
  ['Cups', 'Coupes', 'カップ', 'Copas', 'Pokale', 'Copas'],
  ['Ranks', 'Rangs', 'ランク', 'Ranking', 'Ränge', 'Ranking'],
  ['Share', 'Partager', 'シェア', 'Compartilhar', 'Teilen', 'Compartir'],
  ['Entry', 'Entrée', '初回', 'Entrada', 'Start', 'Entrada'],
  ['Launch', 'Lancer', '起動', 'Abrir', 'Starten', 'Abrir'],
  ['SETTINGS', 'PARAMÈTRES', '設定', 'AJUSTES', 'EINSTELLUNGEN', 'AJUSTES'],
  ['Sound', 'Son', 'サウンド', 'Som', 'Sound', 'Sonido'],
  ['Music', 'Musique', '音楽', 'Música', 'Musik', 'Música'],
  ['Vibration', 'Vibration', '振動', 'Vibração', 'Vibration', 'Vibración'],
  ['Hint arrows', 'Flèches', 'ヒント', 'Setas', 'Pfeile', 'Flechas'],
  ['Comfort', 'Confort', '目に優しい', 'Conforto', 'Komfort', 'Confort'],
  ['Buy items', 'Acheter', 'アイテム購入', 'Comprar itens', 'Items kaufen', 'Comprar objetos'],
  ['Race without a special', 'Courir sans spécial', 'スペシャルなしで走る', 'Correr sem especial', 'Ohne Spezial fahren', 'Correr sin especial'],
  ['Back to the bag', 'Retour au sac', 'バッグに戻る', 'Voltar à bolsa', 'Zurück zur Tasche', 'Volver a la bolsa'],
  ['In your bag', 'Dans ton sac', 'バッグの中', 'Na sua bolsa', 'In deiner Tasche', 'En tu bolsa'],
  ['Take it', 'Prendre', '持っていく', 'Levar', 'Mitnehmen', 'Llevar'],
  ['Cancel', 'Annuler', 'キャンセル', 'Cancelar', 'Abbrechen', 'Cancelar'],
  ['Share my rank', 'Partager mon rang', 'ランクをシェア', 'Compartilhar rank', 'Rang teilen', 'Compartir rango'],
  ['Save image', 'Enregistrer', '画像を保存', 'Salvar imagem', 'Bild speichern', 'Guardar imagen'],
  ['Copy text', 'Copier', 'テキストをコピー', 'Copiar texto', 'Text kopieren', 'Copiar texto'],
  ['Unlocks', 'Débloque', '解放', 'Desbloqueia', 'Schaltet frei', 'Desbloquea'],
  ['Ready to claim', 'À récupérer', '受け取り可能', 'Pronto para coletar', 'Bereit', 'Listo para cobrar'],
  ['Claim all', 'Tout récupérer', 'すべて受け取る', 'Coletar tudo', 'Alle abholen', 'Cobrar todo'],
  ['Account', 'Compte', 'アカウント', 'Conta', 'Konto', 'Cuenta'],
  ['Continue with Google', 'Continuer avec Google', 'Googleで続ける', 'Continuar com Google', 'Weiter mit Google', 'Continuar con Google'],
  ['Continue with Apple', 'Continuer avec Apple', 'Appleで続ける', 'Continuar com Apple', 'Weiter mit Apple', 'Continuar con Apple'],
  ['Send code', 'Envoyer le code', 'コードを送信', 'Enviar código', 'Code senden', 'Enviar código'],
  ['Sign in', 'Se connecter', 'サインイン', 'Entrar', 'Anmelden', 'Iniciar sesión'],
  ['Sign out', 'Se déconnecter', 'サインアウト', 'Sair', 'Abmelden', 'Cerrar sesión'],
  ['Sync now', 'Synchroniser', '今すぐ同期', 'Sincronizar', 'Jetzt synchronisieren', 'Sincronizar'],
  ['Keep this', 'Garder', 'これを残す', 'Manter', 'Behalten', 'Conservar'],
  ['Eye comfort', 'Confort visuel', '目に優しい', 'Conforto visual', 'Augenschonend', 'Confort visual'],
  ['Graphics', 'Graphisme', '画質', 'Gráficos', 'Grafik', 'Gráficos'],
  ['Language', 'Langue', '言語', 'Idioma', 'Sprache', 'Idioma'],
  ['Profile', 'Profil', 'プロフィール', 'Perfil', 'Profil', 'Perfil'],
  ['How to play', 'Comment jouer', '遊び方', 'Como jogar', 'Anleitung', 'Cómo jugar'],
  ['Jump guide', 'Guide du saut', 'ジャンプガイド', 'Guia do salto', 'Sprung-Guide', 'Guía de salto'],
  ['Restore', 'Restaurer', '復元', 'Restaurar', 'Wiederherstellen', 'Restaurar'],
  ['Paused', 'Pause', '一時停止', 'Pausado', 'Pausiert', 'En pausa'],
  ['Resume', 'Reprendre', '再開', 'Continuar', 'Weiter', 'Reanudar'],
  ['Retry', 'Rejouer', 'リトライ', 'De novo', 'Nochmal', 'Reintentar'],
  ['Home', 'Accueil', 'ホーム', 'Início', 'Start', 'Inicio'],
  ['Tracks', 'Circuits', 'コース', 'Pistas', 'Strecken', 'Pistas'],
  ['Next track', 'Circuit suivant', '次のコース', 'Próxima pista', 'Nächste Strecke', 'Siguiente pista'],
  ['GAME OVER', 'PERDU', 'ゲームオーバー', 'FIM DE JOGO', 'GAME OVER', 'FIN DEL JUEGO'],
  ['NEW BEST!', 'RECORD !', '自己ベスト!', 'NOVO RECORDE!', 'NEUER REKORD!', '¡NUEVO RÉCORD!'],
  ['Best', 'Record', 'ベスト', 'Recorde', 'Rekord', 'Récord'],
  ['Distance', 'Distance', '距離', 'Distância', 'Distanz', 'Distancia'],
  ['Coins', 'Pièces', 'コイン', 'Moedas', 'Münzen', 'Monedas'],
  ['Near miss', 'Frôlé', 'ニアミス', 'Por um triz', 'Knapp', 'Roce'],
  ['Time', 'Temps', 'タイム', 'Tempo', 'Zeit', 'Tiempo'],
  ['Lives lost', 'Vies perdues', '失ったライフ', 'Vidas perdidas', 'Verlorene Leben', 'Vidas perdidas'],
  ['Unused boosts', 'Bonus inutilisés', '未使用ブースト', 'Boosts não usados', 'Ungenutzte Boosts', 'Potenciadores sin usar'],
  ['TAP!', 'TAPE !', 'タップ!', 'TOQUE!', 'TIPPEN!', '¡TOCA!'],
  ['Reward', 'Récompense', '報酬', 'Prêmio', 'Belohnung', 'Premio'],
  ['Rewards', 'Récompenses', '報酬', 'Prêmios', 'Belohnungen', 'Premios'],
  ['REVIVE?', 'REVIVRE ?', '復活する？', 'REVIVER?', 'WIEDERBELEBEN?', '¿REVIVIR?'],
  ['Watch ad · Revive', 'Pub · Revivre', '広告で復活', 'Anúncio · Reviver', 'Werbung · Weiter', 'Anuncio · Revivir'],
  ['No thanks · end race', 'Non merci · fin', 'やめる · 終了', 'Não · terminar', 'Nein · beenden', 'No · terminar'],
  ['SPECIAL', 'SPÉCIAL', 'スペシャル', 'ESPECIAL', 'SPEZIAL', 'ESPECIAL'],
  ['No special', 'Aucun spécial', 'スペシャルなし', 'Sem especial', 'Kein Spezial', 'Sin especial'],
  ['Pure skill run', 'Pur talent', '実力勝負', 'Só habilidade', 'Nur Können', 'Solo habilidad'],
  ['GO', 'GO', 'GO', 'VAI', 'LOS', 'YA'],
  ['RANK GATE', 'PORTE DE RANG', 'ランクゲート', 'PORTÃO DE RANK', 'RANG-TOR', 'PUERTA DE RANGO'],
  ['Bonus', 'Bonus', 'ボーナス', 'Bônus', 'Bonus', 'Bonus'],
  ['BONUS', 'BONUS', 'ボーナス', 'BÔNUS', 'BONUS', 'BONUS'],
  ['Training', 'Entraînement', 'トレーニング', 'Treino', 'Training', 'Entrenamiento'],
  ['Replay freely', 'Rejouable à volonté', '何度でもプレイ可', 'Jogue à vontade', 'Beliebig oft', 'Repite cuanto quieras'],
  ['Every hour', 'Chaque heure', '毎時', 'Toda hora', 'Jede Stunde', 'Cada hora'],
  ['Race the Bonus', 'Courir le Bonus', 'ボーナスに挑戦', 'Correr o Bônus', 'Bonus fahren', 'Correr el Bonus'],
  ['Coming soon', 'Bientôt', '近日公開', 'Em breve', 'Bald', 'Próximamente'],
  ['Race Endless', 'Courir Endless', 'エンドレスへ', 'Correr Endless', 'Endless fahren', 'Correr Endless'],
  ['Free coins', 'Pièces gratuites', '無料コイン', 'Moedas grátis', 'Gratis-Münzen', 'Monedas gratis'],
  ['Race', 'Course', 'レース', 'Correr', 'Rennen', 'Carrera'],
  ['How EXP works', 'Comment marche l’EXP', 'EXPの仕組み', 'Como funciona o EXP', 'So funktioniert EXP', 'Cómo funciona el EXP'],
  ['Best EXP', 'Meilleur EXP', 'ベストEXP', 'Melhor EXP', 'Bester EXP', 'Mejor EXP'],
  ['NEW BEST EXP!', 'NOUVEAU RECORD EXP !', 'EXP新記録！', 'NOVO RECORDE DE EXP!', 'NEUER EXP-REKORD!', '¡NUEVO RÉCORD DE EXP!'],
  ['How rank works', 'Comment marche le rang', 'ランクの仕組み', 'Como funciona o rank', 'So funktioniert der Rang', 'Cómo funciona el rango'],
  ['Score', 'Score', 'スコア', 'Pontos', 'Punkte', 'Puntos'],
  ['CONTINUE?', 'CONTINUER ?', 'コンティニュー?', 'CONTINUAR?', 'WEITER?', '¿CONTINUAR?'],
  ['No thanks', 'Non merci', '結構です', 'Não, obrigado', 'Nein danke', 'No, gracias'],
  ['SELECT TRACK', 'CHOISIR UN CIRCUIT', 'コース選択', 'ESCOLHER PISTA', 'STRECKE WÄHLEN', 'ELEGIR PISTA'],
  ['Endless', 'Infini', 'エンドレス', 'Infinito', 'Endlos', 'Infinito'],
  ['GARAGE', 'GARAGE', 'ガレージ', 'GARAGEM', 'GARAGE', 'GARAJE'],
  ['Selected', 'Sélectionnée', '選択中', 'Selecionado', 'Ausgewählt', 'Seleccionado'],
  ['Select', 'Choisir', '選択', 'Selecionar', 'Wählen', 'Elegir'],
  ['Upgrades', 'Améliorations', 'アップグレード', 'Melhorias', 'Upgrades', 'Mejoras'],
  ['MISSIONS', 'MISSIONS', 'ミッション', 'MISSÕES', 'MISSIONEN', 'MISIONES'],
  ['DAILY', 'QUOTIDIEN', 'デイリー', 'DIÁRIO', 'TÄGLICH', 'DIARIO'],
  ['CUPS', 'COUPES', 'カップ', 'COPAS', 'POKALE', 'COPAS'],
  ['SHOP', 'BOUTIQUE', 'ショップ', 'LOJA', 'SHOP', 'TIENDA'],
  ['TOP PILOTS', 'MEILLEURS PILOTES', 'トップパイロット', 'MELHORES PILOTOS', 'TOP-PILOTEN', 'MEJORES PILOTOS'],
  ['This week', 'Cette semaine', '今週', 'Esta semana', 'Diese Woche', 'Esta semana'],
  ['All time', 'Toujours', '全期間', 'Geral', 'Allzeit', 'Histórico'],
  ['Race now', 'Courir', 'レース開始', 'Correr agora', 'Jetzt fahren', 'Correr ya'],
  ['Standings', 'Classement', '順位', 'Classificação', 'Stand', 'Clasificación'],
  ['Prizes', 'Prix', '賞品', 'Prêmios', 'Preise', 'Premios'],
  ['Divisions', 'Divisions', 'ディビジョン', 'Divisões', 'Divisionen', 'Divisiones'],
  ['Upcoming', 'À venir', '開催予定', 'Próximas', 'Demnächst', 'Próximas'],
  ['CLAIM', 'RÉCUPÉRER', '受け取る', 'RESGATAR', 'ABHOLEN', 'RECLAMAR'],
  ['DAILY REWARD', 'RÉCOMPENSE DU JOUR', 'デイリー報酬', 'PRÊMIO DIÁRIO', 'TAGESBELOHNUNG', 'PREMIO DIARIO'],
  ['ENTRY REWARD', 'BONUS D’ENTRÉE', '初回報酬', 'PRÊMIO DE ENTRADA', 'START-BONUS', 'PREMIO DE ENTRADA'],
  ['LAUNCH REWARD', 'BONUS DE LANCEMENT', '起動報酬', 'PRÊMIO DE ABERTURA', 'START-BELOHNUNG', 'PREMIO DE INICIO'],
  ['SHARE REWARDS', 'BONUS DE PARTAGE', 'シェア報酬', 'PRÊMIO POR COMPARTILHAR', 'TEILEN-BONUS', 'PREMIO POR COMPARTIR'],
  ['INVITE FRIENDS', 'INVITER DES AMIS', '友達を招待', 'CONVIDAR AMIGOS', 'FREUNDE EINLADEN', 'INVITAR AMIGOS'],
  ['RATE US', 'NOTEZ-NOUS', '評価する', 'AVALIE-NOS', 'BEWERTE UNS', 'VALÓRANOS'],
  ['ADD TO SCREEN', 'AJOUTER À L’ÉCRAN', 'ホーム画面に追加', 'ADICIONAR À TELA', 'ZUM HOMESCREEN', 'AÑADIR A INICIO'],
  ['NO CONNECTION', 'PAS DE CONNEXION', '接続なし', 'SEM CONEXÃO', 'KEINE VERBINDUNG', 'SIN CONEXIÓN'],
  ['WATCH AD REWARD', 'PUB RÉCOMPENSÉE', '動画で報酬', 'PRÊMIO POR ANÚNCIO', 'WERBE-BELOHNUNG', 'PREMIO POR ANUNCIO'],
  ['WELCOME BACK', 'BON RETOUR', 'おかえり', 'BEM-VINDO DE VOLTA', 'WILLKOMMEN ZURÜCK', 'BIENVENIDO DE NUEVO'],
  ['SHARE', 'PARTAGER', 'シェア', 'COMPARTILHAR', 'TEILEN', 'COMPARTIR'],
  ['RATE NOW', 'NOTER', '評価する', 'AVALIAR', 'BEWERTEN', 'VALORAR'],
  ['NOT NOW', 'PLUS TARD', '後で', 'AGORA NÃO', 'SPÄTER', 'AHORA NO'],
  ['GOT IT', 'COMPRIS', 'OK', 'ENTENDI', 'VERSTANDEN', 'ENTENDIDO'],
  ['RETRY', 'RÉESSAYER', '再試行', 'TENTAR DE NOVO', 'ERNEUT', 'REINTENTAR'],
  ['OPEN PROFILE', 'OUVRIR LE PROFIL', 'プロフィールを開く', 'ABRIR PERFIL', 'PROFIL ÖFFNEN', 'ABRIR PERFIL'],
  ['YOUR PROFILE', 'TON PROFIL', 'プロフィール', 'SEU PERFIL', 'DEIN PROFIL', 'TU PERFIL'],
  ['PILOT', 'PILOTE', 'パイロット', 'PILOTO', 'PILOT', 'PILOTO'],
  ['Leaderboard', 'Classement', 'ランキング', 'Ranking', 'Rangliste', 'Clasificación'],
  ['Trophies', 'Trophées', 'トロフィー', 'Troféus', 'Trophäen', 'Trofeos'],
  ['Runs', 'Courses', 'プレイ数', 'Corridas', 'Läufe', 'Carreras'],
  ['Car', 'Voiture', '車', 'Carro', 'Auto', 'Coche'],
  ['Save', 'Enregistrer', '保存', 'Salvar', 'Speichern', 'Guardar'],
  ['Practice it', 'S’entraîner', '練習する', 'Praticar', 'Üben', 'Practicar'],
  ['PILOT TRAINING', 'ENTRAÎNEMENT', 'パイロット訓練', 'TREINO DE PILOTO', 'PILOTENTRAINING', 'ENTRENAMIENTO'],
  ['Start training', 'Commencer', '訓練開始', 'Começar treino', 'Training starten', 'Empezar'],
  ['Skip', 'Passer', 'スキップ', 'Pular', 'Überspringen', 'Saltar'],
  ['TRAINING COMPLETE', 'ENTRAÎNEMENT TERMINÉ', '訓練完了', 'TREINO CONCLUÍDO', 'TRAINING FERTIG', 'ENTRENAMIENTO COMPLETO'],
  ["Let's race", 'C’est parti', 'レース開始', 'Vamos correr', 'Los geht’s', '¡A correr!'],
  ['Collect', 'Récupérer', '受け取る', 'Coletar', 'Einsammeln', 'Recoger'],
  ['CUP RESULTS', 'RÉSULTATS DE LA COUPE', 'カップ結果', 'RESULTADOS DA COPA', 'POKALERGEBNISSE', 'RESULTADOS DE LA COPA'],
  ['Speed', 'Vitesse', 'スピード', 'Velocidade', 'Tempo', 'Velocidad'],
  ['Auto-collect rewards', 'Récupération auto', '報酬を自動受取', 'Coletar prêmios automaticamente', 'Belohnungen automatisch', 'Recoger premios automáticamente'],
  ['Boosts for this run', 'Bonus pour cette course', 'このレースのブースト', 'Boosts desta corrida', 'Boosts für diesen Lauf', 'Potenciadores de esta carrera'],
  ['FINISH!', 'ARRIVÉE !', 'ゴール!', 'CHEGADA!', 'ZIEL!', '¡META!'],
];

const IDX: Record<Lang, number> = { en: 0, fr: 1, ja: 2, pt: 3, de: 4, es: 5 };
const MAP = new Map<string, (typeof T)[number]>(T.map((row) => [row[0].toLowerCase(), row]));

let current: Lang = 'en';
const ORIG = new WeakMap<Text, string>();

export const getLang = () => current;

export function tr(en: string, lang: Lang = current) {
  const row = MAP.get(en.trim().toLowerCase());
  return row ? row[IDX[lang]] : en;
}

/** translate (or restore) every known text node under `root` */
export function translateTree(root: Node, lang: Lang = current) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const orig = ORIG.get(t) ?? t.data;
    const key = orig.trim();
    if (!key || key.length > 60) continue;
    const row = MAP.get(key.toLowerCase());
    if (!row) continue;
    if (!ORIG.has(t)) ORIG.set(t, orig);
    const out = lang === 'en' ? orig : orig.replace(key, row[IDX[lang]]);
    if (t.data !== out) t.data = out;
  }
}

export function setLang(lang: Lang, root: Node) {
  current = lang;
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  translateTree(root, lang);
}

/** v3 native: switch language without a DOM (the canvas UI translates while drawing) */
export function setLangCode(lang: Lang) {
  current = lang;
}
