class Load extends Phaser.Scene {
    constructor() {
        super("loadScene");
    }

    preload() {
        this.load.setPath("./assets/");

        // Load characters spritesheet
        this.load.atlas("platformer_characters", "tilemap-characters-packed.png", "tilemap-characters-packed.json");

        // Load tilemap information
        this.load.image("tilemap_tiles", "tilemap_packed.png");                         // Packed tilemap
        this.load.tilemapTiledJSON("platformer-level-1", "platformer-level-1.tmj");   // Tilemap in JSON

        // Load the tilemap as a spritesheet
        this.load.spritesheet("tilemap_sheet", "tilemap_packed.png", {
            frameWidth: 18,
            frameHeight: 18
        });

        // Font
        this.load.bitmapFont('myFont', 'pixelFont.png', 'pixel.xml');

        // Audio
        this.load.audio('levelCompleteSound', 'mixkit-game-level-completed-2059.wav');
        this.load.audio('jumpSound', 'mixkit-player-jumping-in-a-video-game-2043.wav');
        this.load.audio('diamondSound', 'mixkit-video-game-treasure-2066.wav');
        this.load.audio('coinSound', 'coin-257878.mp3');
        this.load.audio('walkSound', 'walk-on-grass-1-291984.mp3');
        this.load.audio('uiClick', 'mixkit-classic-click-1117.wav');
        this.load.audio('bgMusic', 'exploration-chiptune-rpg-adventure-theme-336428.mp3');
        this.load.audio('deathSound', 'dead.mp3');
        this.load.audio('checkpointSound', 'checkpoint.mp3');

        // Oooh, fancy. A multi atlas is a texture atlas which has the textures spread
        // across multiple png files, so as to keep their size small for use with
        // lower resource devices (like mobile phones).
        // kenny-particles.json internally has a list of the png files
        // The multiatlas was created using TexturePacker and the Kenny
        // Particle Pack asset pack.
        this.load.multiatlas("kenny-particles", "kenny-particles.json");
    }

    create() {
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNames('platformer_characters', {
                prefix: "tile_",
                start: 0,
                end: 1,
                suffix: ".png",
                zeroPad: 4
            }),
            frameRate: 15,
            repeat: -1
        });

        this.anims.create({
            key: 'idle',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0000.png" }
            ],
            repeat: -1
        });

        this.anims.create({
            key: 'jump',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0001.png" }
            ],
        });

        this.anims.create({
            key: 'coinSpin',
            frames: this.anims.generateFrameNumbers('tilemap_sheet', {
                start: 151,
                end: 152
            }),
            frameRate: 8,
            repeat: -1  // loop forever
        });

        this.anims.create({
            key: 'flagWave',
            frames: this.anims.generateFrameNumbers('tilemap_sheet', {
                start: 111,
                end: 112
            }),
            frameRate: 8,
            repeat: -1  // loop forever
        });

        this.backgroundMusic = this.sound.add('bgMusic', {
            volume: 0.4,
            loop: true
        });

        // Start background music
        let bgMusic = this.registry.get('bgMusic') || false;
        this.registry.set('bgMusic', bgMusic); // Set if music is playing
        if (!bgMusic) {
            this.registry.set('bgMusic', this.backgroundMusic); // Set music
            this.registry.get('bgMusic').play(); // Play background music
        }

         // ...and pass to the next Scene
         this.scene.start("menu");
    }

    // Never get here since a new scene is started in create()
    update() {
    }
}