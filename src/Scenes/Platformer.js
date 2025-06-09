class Platformer extends Phaser.Scene {
    constructor() {
        super("level1");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 500; // acceleration of the player
        this.DRAG = 6 * this.ACCELERATION; // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500; // gravity
        this.JUMP_VELOCITY = -500; // jump velocity
        this.PARTICLE_VELOCITY = 50; // velocity of the particles
        this.SCALE = 2.0; // scale of the game
        this.MAX_VELOCITY = 300; // max speed
        this.MAX_FALL_VELOCITY = 750; // max fall speed

        // Spawn points
        this.DEFAULT_SPAWN_POINT = [430, 400]; // default spawn point
        this.spawnPoint = this.DEFAULT_SPAWN_POINT; // spawn point
        this.endPoint = [250, 500]; // end spawn point
        //this.spawnPoint = [2005, 100]; // Inside mountain spawn point

        // Game states
        this.isGameOver = false;
        this.wasGrounded = false;
        this.inputLocked = false;
        this.playerDead = false; // flag to check if the player is dead
        this.respawning = false; // flag to check if the player is respawning

        // Coyote time
        this.coyoteTime = 0;
        this.COYOTE_DURATION = 100; // milliseconds of grace period

        // Jump buffer
        this.jumpBufferRemaining = 0;
        this.hasJumped = false; // flag to check if the player has jumped
        this.JUMP_BUFFER_DURATION = 100; // milliseconds to buffer a jump input

        // Variable jump
        this.JUMP_CUTOFF_VELOCITY = -200;  // Control how "short" a short hop is

        // Movement SFX cooldowns
        this.walkStepCooldown = 0;
        this.STEP_INTERVAL = 200; // ms between steps

        // Global depths
        this.UI_DEPTH = 99; // UI depth for buttons and text
    }

    preload() {
        this.load.scenePlugin('AnimatedTiles', './lib/AnimatedTiles.js', 'animatedTiles', 'animatedTiles');
    }

    create() {
        // Create a new tilemap game object
        this.map = this.add.tilemap("platformer-level-1", 18, 18, 120, 30);

        // Add a tileset to the map
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");

        // Create layers
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.invisibleLayer = this.map.createLayer("Invisible", this.tileset, 0, 0).setVisible(false);
        this.undergroundLayer = this.map.createLayer("Underground", this.tileset, 0, 0);
        this.detailLayer = this.map.createLayer("Details", this.tileset, 0, 0);
        this.waterfallLayer = this.map.createLayer("Waterfalls", this.tileset, 0, 0);

        // Order the layers
        this.groundLayer.setDepth(-1);
        this.undergroundLayer.setDepth(-3);
        this.detailLayer.setDepth(-2);
        this.waterfallLayer.setDepth(2);

        // Enable animated tiles
        this.animatedTiles.init(this.map);

        // Make it collidable
        this.groundLayer.setCollisionByProperty({
            collides: true
        });
        this.invisibleLayer.setCollisionByProperty({
            collides: true
        });

        // set up player avatar
        my.sprite.player = this.physics.add.sprite(this.spawnPoint[0], this.spawnPoint[1], "platformer_characters", "tile_0000.png");
        my.sprite.player.setFlip(true, false); // face right
        my.sprite.player.setMaxVelocity(this.MAX_VELOCITY, 1500); // max speed
        my.sprite.player.body.setSize(14, 16).setOffset(6, 6);
        my.sprite.player.setDepth(1);
        my.sprite.player.setOrigin(0.5, 1); // Origin to center bottom
        this.lastSafePosition = this.spawnPoint;

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);
        this.physics.add.collider(my.sprite.player, this.invisibleLayer);

        // Bounds
        this.physics.world.setBounds(0, -0, this.map.widthInPixels, this.map.heightInPixels);
        this.physics.world.setBoundsCollision(true, true, true, false);  // left, right, top, bottom
        my.sprite.player.setCollideWorldBounds(true);

        // Add camera
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1); // (target, [,roundPixels][,lerpX][,lerpY])
        this.cameras.main.setDeadzone(20, 20);
        this.cameras.main.setZoom(this.SCALE);
        // Set the background color
        const bgColor = this.cache.tilemap.get("platformer-level-1").data.backgroundcolor;
        if (bgColor) this.cameras.main.setBackgroundColor(bgColor);

        // Set up UI
        this.addButtons();
        this.setupScore();

        // Juice
        this.setupInput();
        this.setupAudio();
        this.setupVFX();

        // Game objects
        this.addObjects();
        this.addMovingPlatforms();
        this.setupEnemies();

        // Enable pathfinding
        this.initEasyStar();
        this.flyingEnemyGroup.getChildren().forEach(enemy => {
            this.findPath(enemy);
        });

        // Load saved game
       const isNewGame = this.registry.get('newGame');
        this.registry.set('newGame', false); // reset for future restarts

        if (!isNewGame) {
            const saved = localStorage.getItem('savedCheckpoint');
            if (saved) {
                const checkpoint = JSON.parse(saved);
                
                if (checkpoint.scene === this.scene.key) {
                    my.sprite.player.x = checkpoint.spawnX;
                    my.sprite.player.y = checkpoint.spawnY;
                    this.registry.set('playerScore', checkpoint.score);
                    my.sprite.player.setPosition(checkpoint.spawnX, checkpoint.spawnY);
                }
            }
        }

        if (this.inputLocked === undefined) { // initialize inputLocked if not already set
            this.inputLocked = true;
        }

        if (this.inputLocked) { // if input is locked, show the menu
            this.scene.launch('menu');
        }
    }

    update(time, delta) {
        const groundedNow = my.sprite.player.body.blocked.down;
        let isWalking = this.handleMovement(groundedNow); // Handle player movement and return if walking

        // Play walking sound
        this.movementSFX(delta, isWalking, groundedNow);

        // Add juice
        this.characterJuice(8, 0.9); // Lean angle, squash factor

        // Handle jumping
        this.handleJump(groundedNow, delta);
        if (my.sprite.player.body.velocity.y > this.MAX_FALL_VELOCITY) my.sprite.player.body.setVelocityY(this.MAX_FALL_VELOCITY);

        // Handle landing VFX
        this.landingVFX(groundedNow);

        // If below world
        if(my.sprite.player.y > this.scale.height) this.playerDead = true;

        // Update if player is on safe ground
        this.updateSafeGround(groundedNow);

        // Handle enemy movement
        this.enemyGroup.getChildren().forEach(enemy => {this.moveGroundEnemy(enemy);});
        this.flyingEnemyGroup.getChildren().forEach(enemy => {this.moveFlyingEnemy(enemy);});

        // Respawn if player is dead
        if (this.playerDead && !this.respawning) this.handleRespawn();

        // Save game state
        this.saveGame();

        // Update for next frame
        this.wasGrounded = groundedNow;
    }

    /*************************************************************************************************************** 
    -------------------------------------------------- Pathfinding -------------------------------------------------
    ***************************************************************************************************************/

    initEasyStar() {
        this.easystar = new EasyStar.js();

        // Create a grid where 0 = empty, 1 = blocked
        const grid = [];
        for (let y = 0; y < this.map.height; y++) {
            const row = [];
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.groundLayer.getTileAt(x, y);
                row.push(tile ? 1 : 0); // 1 = wall, 0 = empty space
            }
            grid.push(row);
        }

        this.easystar.setGrid(grid);
        this.easystar.setAcceptableTiles([0]); // Only allow movement through empty space
        this.easystar.enableDiagonals(); // Diagonal movement
    }

    worldToTile = (x, y) => ({
        x: Math.floor(x / this.map.tileWidth),
        y: Math.floor(y / this.map.tileHeight)
    });

    tileToWorld = (tx, ty) => ({
        x: tx * this.map.tileWidth + this.map.tileWidth / 2,
        y: ty * this.map.tileHeight + this.map.tileHeight / 2
    });

    findPath(enemy) {
        let lastPlayerTile = null;

        this.time.addEvent({
            delay: 200, // Reduce delay for more responsiveness
            loop: true,
            callback: () => {
                // Skip pathfinding when input is locked
                if (this.inputLocked) return;

                const start = this.worldToTile(enemy.x, enemy.y);
                const end = this.worldToTile(my.sprite.player.x, my.sprite.player.y);

                // Bounds check
                if (
                    start.x < 0 || start.y < 0 || end.x < 0 || end.y < 0 ||
                    start.x >= this.map.width || start.y >= this.map.height ||
                    end.x >= this.map.width || end.y >= this.map.height
                ) return;

                // Only update path if player moved to a new tile
                if (!lastPlayerTile || end.x !== lastPlayerTile.x || end.y !== lastPlayerTile.y) {
                    lastPlayerTile = end;

                    this.easystar.findPath(start.x, start.y, end.x, end.y, path => {
                        if (path && path.length > 1) {
                            enemy.path = path;
                            enemy.pathIndex = 1;
                        }
                    });

                    this.easystar.calculate();
                }
            }
        });
    }

    moveFlyingEnemy(enemy) {
        if (this.inputLocked) { // prevent movement while input is locked
            enemy.setVelocity(0);
            return;
        }

        if (!enemy.path || enemy.pathIndex >= enemy.path.length) {
            // Move directly toward the player instead
            const dx = my.sprite.player.x - enemy.x;
            const dy = my.sprite.player.y - enemy.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 2) {
                const angle = Math.atan2(dy, dx);
                enemy.setVelocity(Math.cos(angle) * enemy.speed, Math.sin(angle) * enemy.speed);
            } else {
                enemy.setVelocity(0);
            }

            return;
        }

        const targetTile = enemy.path[enemy.pathIndex];
        const { x: worldX, y: worldY } = this.tileToWorld(targetTile.x, targetTile.y);

        const dx = worldX - enemy.x;
        const dy = worldY - enemy.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 4) {
            enemy.setVelocity(0);
            enemy.pathIndex++;
        } else {
            const angle = Math.atan2(dy, dx);
            enemy.setVelocity(Math.cos(angle) * enemy.speed, Math.sin(angle) * enemy.speed);
        }
    }

    moveGroundEnemy(enemy) {
        if (this.inputLocked) { // prevent movement while input is locked
            enemy.setVelocity(0);
            return;
        }

        const body = enemy.body;
        let turned = false;

        // Always apply movement when not locked
        enemy.setVelocityX(enemy.speed * enemy.direction);

        // Flip sprite based on direction
        enemy.setFlipX(enemy.direction > 0);

        // Check for wall collision
        if ((body.blocked.left && enemy.direction < 0) || (body.blocked.right && enemy.direction > 0)) {
            enemy.direction *= -1;
            enemy.setVelocityX(enemy.speed * enemy.direction);
            turned = true;
        }

        // Check tile ahead to avoid falling off a ledge
        if (!turned) {
            const aheadX = enemy.x + enemy.direction * (enemy.width / 2 + 4);
            const aheadY = enemy.y + 2; // Just below the enemy's feet
            const tile = this.groundLayer.getTileAtWorldXY(aheadX, aheadY);

            if (!tile) {
                enemy.direction *= -1;
                enemy.setVelocityX(enemy.speed * enemy.direction);
            }
        }
    }

    /*************************************************************************************************************** 
    -------------------------------------------------- GAME SETUP --------------------------------------------------
    ***************************************************************************************************************/

    createEnemy(x, y, frame, group, flying, id, speed) {
        const enemy = group.create(x, y, 'platformer_characters', frame);
        enemy.setOrigin(0.5, 1); // Set origin to center bottom
        enemy.body.setSize(enemy.width, enemy.height); // Modify size to fit sprite
        enemy.setCollideWorldBounds(true); // Ensure it doesn't go out of bounds
        enemy.speed = speed || 50; // Default speed for enemies

        this.enemyCount = (this.enemyCount || 0) + 1; // Increment enemy count
        enemy._id = id; // Assign ID based on count

        if (flying) {
            enemy.path = null; // Initialize path for flying enemies
            enemy.pathIndex = 0; // Initialize path index
            enemy.body.setSize(enemy.width, enemy.height / 4); // Modify size to fit sprite
        } else {
            enemy.direction = 1; // Default direction for ground enemies
            enemy.setVelocityX(enemy.speed * enemy.direction); // Set initial velocity
            //enemy.allowGravity = true; // Allow gravity for ground enemies
        }

        return enemy;
    }

    setupEnemies() {
        // Load defeated enemies from localStorage (at the top)
        const defeated = new Set(JSON.parse(localStorage.getItem('defeatedEnemies') || '[]'));

        // Create enemy group
        this.enemyGroup = this.physics.add.group({
            immovable: true,
            allowGravity: true
        });
        this.flyingEnemyGroup = this.physics.add.group({
            immovable: true,
            allowGravity: false
        });

        // Add enemies
        const flyingEnemy1 = this.createEnemy(600, 100, 'tile_0025.png', this.flyingEnemyGroup, true, "flying_enemy_1", 75);
        const basicEnemy1 = this.createEnemy(650, 350, 'tile_0022.png', this.enemyGroup, false, "enemy_1", 50);
        const basicEnemy2 = this.createEnemy(1000, 150, 'tile_0022.png', this.enemyGroup, false, "enemy_2", 50);
        const basicEnemy3 = this.createEnemy(1300, 150, 'tile_0022.png', this.enemyGroup, false, "enemy_3", 50);
        const basicEnemy4 = this.createEnemy(1550, 150, 'tile_0022.png', this.enemyGroup, false, "enemy_4", 50);

        // Remove defeated enemies
        [this.enemyGroup, this.flyingEnemyGroup].forEach(group => {
            group.getChildren().forEach(enemy => {
                if (defeated.has(enemy._id)) {
                    enemy.destroy(); // Remove defeated enemy
                }
            });
        });

        // Ground collision logic for ground enemies
        this.physics.add.collider(this.enemyGroup, this.groundLayer);

        // Add enemy collision logic
        [this.enemyGroup, this.flyingEnemyGroup].forEach(group => {
            this.physics.add.collider(my.sprite.player, group, (player, enemy) => {
                const enemyId = enemy._id;

                const verticalVelocity = player.body.velocity.y;
                const isAbove = verticalVelocity <= 0 && player.body.bottom <= enemy.body.top + 5;

                if (isAbove) {
                    const current = new Set(JSON.parse(localStorage.getItem('defeatedEnemies') || '[]'));
                    current.add(enemyId);
                    localStorage.setItem('defeatedEnemies', JSON.stringify([...current]));

                    enemy.destroy();
                    player.setVelocityY(-200);
                    this.jumpSound.play();
                } else {
                    this.playerDead = true;
                }
            });
        });
    }

    setupInput() {
        // Input handling
        cursors = this.input.keyboard.createCursorKeys();
        this.dKey = this.input.keyboard.addKey('D');
        this.aKey = this.input.keyboard.addKey('A');
        this.spaceKey = this.input.keyboard.addKey('SPACE');

        this.input.keyboard.on('keydown-ESC', () => {
            if (!this.scene.isActive('PauseOverlay') && !this.scene.isActive('menu')) {
                this.click.play(); // Play button click sound
                this.scene.launch('PauseOverlay', { gameSceneKey: this.scene.key });
                this.inputLocked = true; // Lock input while paused
            }
        });

        this.input.keyboard.on('keydown-R', () => {
            my.sprite.player.setVelocity(0, 0); // reset velocity
            my.sprite.player.setAcceleration(0, 0); // reset acceleration
            my.sprite.player.setDrag(0, 0); // reset drag
            my.sprite.player.setPosition(this.spawnPoint[0], this.spawnPoint[1]); // respawn at last checkpoint
        });

        this.input.keyboard.on('keydown-P', () => {
            my.sprite.player.setVelocity(0, 0); // reset velocity
            my.sprite.player.setAcceleration(0, 0); // reset acceleration
            my.sprite.player.setDrag(0, 0); // reset drag
            my.sprite.player.setPosition(this.endPoint[0], this.endPoint[1]); // respawn at last checkpoint
        });
    }

    setupAudio() {
        // Store audio
        this.walkSound = this.sound.add('walkSound', {
            loop: true
        }); 
        this.jumpSound = this.sound.add('jumpSound', {
            volume: 0.25,
            loop: false
        });
        this.levelCompleteSound = this.sound.add('levelCompleteSound', {
            volume: 0.5,
            loop: false
        });
        this.click = this.sound.add('uiClick', {
            volume: 0.2
        });
        this.deadSound = this.sound.add('deathSound', {
            volume: 0.3,
            loop: false
        });
        this.checkpointSound = this.sound.add('checkpointSound', {
            volume: 0.2,
            loop: false
        });
    }

    setupVFX() {
        // Movement vfx
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            random: true,
            scale: {start: 0.03, end: 0.05},
            maxAliveParticles: 3,
            lifespan: 250,
            gravityY: -50,
            duration: 500,
            alpha: {start: 1, end: 0.25}, 
        });
        my.vfx.walking.stop();

        // Jumping vfx
        my.vfx.jumping = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_10.png'],
            scale: {start: 0.03, end: 0.07},
            maxAliveParticles: 1,
            lifespan: 200,
            gravityY: -50,
            duration: 1,
            alpha: {start: 1, end: 0.4}
        });
        my.vfx.jumping.setDepth(2); // Ensure it appears above the player
        my.vfx.jumping.stop();

        // Landing vfx
        my.vfx.landing = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_10.png'],
            scale: {start: 0.03, end: 0.06},
            maxAliveParticles: 1,
            lifespan: 200,
            gravityY: -50,
            duration: 1,
            alpha: {start: 1, end: 0.4}
        });
        my.vfx.landing.setDepth(2); // Ensure it appears above the player
        my.vfx.landing.stop();

        // Collect vfx
        my.vfx.collect = this.add.particles(0, 0, "kenny-particles", {
            frame: ['star_08.png'],
            scale: {start: 0.03, end: 0.06},
            maxAliveParticles: 1,
            lifespan: 1000,
            gravityY: -50,
            duration: 1,
            alpha: {start: 0.8, end: 0.25}
        });
        my.vfx.collect.setDepth(10); // Ensure it appears behind the player
        my.vfx.collect.stop();

        // Bubbles
        this.createBubbles(330, 405, 155, 155);
        this.createBubbles(330, 500, 545, 545);
        this.createBubbles(510, 600, 450, 545);
        this.createBubbles(1160, 1240, 515, 545);
        this.createBubbles(1410, 1640, 500, 545);
        this.createBubbles(1645, 1725, 440, 545);
    }

    setupScore() {
        // Save player score
        let playerScore = this.registry.get('playerScore') || 0;
        this.registry.set('playerScore', playerScore);
        
        let xPos = 1200;
        let yPos = 720;
        let fontSize = 12;
        // Add score text
        this.displayScore = this.add.bitmapText(xPos, yPos, 'myFont', 'Score: ' + this.registry.get('playerScore'), fontSize);
        this.displayScore.setScrollFactor(0); // Make it not scroll with the camera

        // Add high score text
        //this.displayHighScore = this.add.bitmapText(xPos, yPos + 25, 'myFont', 'High: ' + (parseInt(localStorage.getItem('highScore')) || 0), fontSize);
        //this.displayHighScore.setScrollFactor(0); // Make it not scroll with the camera

        // Move to front
        this.displayScore.setDepth(this.UI_DEPTH);
        //this.displayHighScore.setDepth(this.UI_DEPTH);
    }

    updateScore(givenPoints) {
        let score = this.registry.get('playerScore') + givenPoints;
        this.registry.set('playerScore', score);
        this.displayScore.setText('Score: ' + this.registry.get('playerScore'));
    }

    addButtons() {
        // Restart game button
        // Create a semi-transparent overlay
        this.buttonRect = this.add.rectangle(this.scale.width/2, this.scale.height/2 + 20, 200, 60, 0x000000, 0.5)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0) // Make it not scroll with the camera
        .setVisible(false) // Hide the rectangle initially
        .setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        this.buttonRect2 = this.add.rectangle(this.scale.width/2, this.scale.height/2 + 100, 200, 60, 0x000000, 0.5)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0) // Make it not scroll with the camera
        .setVisible(false) // Hide the rectangle initially
        .setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        this.buttonRect3 = this.add.rectangle(this.scale.width/2, this.scale.height/2 + 180, 200, 60, 0x000000, 0.5)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0) // Make it not scroll with the camera
        .setVisible(false) // Hide the rectangle initially
        .setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        this.rects = [this.buttonRect, this.buttonRect2, this.buttonRect3];

        // Display "Game Over" text
        this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, "Game over", {
            fontSize: "32px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 5
        }).setOrigin(0.5)
        .setVisible(false) // Hide the text initially
        .setDepth(this.UI_DEPTH) // Ensure it appears above other elements
        .setScrollFactor(0); // Make it not scroll with the camera

        // Continue button
        this.continueButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, "Resume", {
            fontSize: "24px",
            backgroundColor: "#ffffff",
            color: "#000000",
            padding: { x: 49.5, y: 10 } // Add padding around the text
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // Play click sound
            this.sound.play('uiClick', {
                volume: 0.5,
                loop: false
            });
            this.restartGame(false);
        }).setOrigin(0.5, 0.5)
        .setScrollFactor(0) // Make it not scroll with the camera
        .setVisible(false) // Hide the button initially
        .setInteractive(false) // Disable interaction initially
        .setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        // Restart button
        this.restartButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 100, "Play Again", {
            fontSize: "24px",
            backgroundColor: "#ffffff",
            color: "#000000",
            padding: { x: 20, y: 10 } // Add padding around the text
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // Play click sound
            this.sound.play('uiClick', {
                volume: 0.5,
                loop: false
            });
            this.restartGame(true);
        }).setOrigin(0.5, 0.5)
        .setScrollFactor(0) // Make it not scroll with the camera
        .setVisible(false) // Hide the button initially
        .setInteractive(false) // Disable interaction initially
        .setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        // Title screen button
        this.titleButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 180, "Title Screen", {
            fontSize: "24px",
            backgroundColor: "#ffffff",
            color: "#000000",
            padding: { x: 4, y: 10 } // Add padding around the text
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // Play click sound
            this.sound.play('uiClick', {
                volume: 0.5,
                loop: false
            });
            this.scene.start('menu');
        }).setOrigin(0.5, 0.5)
        .setScrollFactor(0) // Make it not scroll with the camera
        .setVisible(false) // Hide the button initially
        .setInteractive(false) // Disable interaction initially
        .setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        this.buttons = [this.continueButton, this.restartButton, this.titleButton];
    }

    addObjects() {
        // TODO: Add createFromObjects here
        // Find coins in the "Objects" layer in Phaser
        // Look for them by finding objects with the name "coin"
        // Assign the coin texture from the tilemap_sheet sprite sheet
        // Phaser docs:
        // https://newdocs.phaser.io/docs/3.80.0/focus/Phaser.Tilemaps.Tilemap-createFromObjects

        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });

        this.diamonds = this.map.createFromObjects("Objects", {
            name: "diamond",
            key: "tilemap_sheet",
            frame: 67
        });

        this.checkpoints = this.map.createFromObjects("Objects", {
            name: "flag",
            key: "tilemap_sheet",
            frame: 111
        });
        
        // TODO: Add turn into Arcade Physics here
        // Since createFromObjects returns an array of regular Sprites, we need to convert 
        // them into Arcade Physics sprites (STATIC_BODY, so they don't move) 
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.diamonds, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.checkpoints, Phaser.Physics.Arcade.STATIC_BODY);

        // Create a Phaser group out of the array this.coins
        // This will be used for collision detection below.
        this.coinGroup = this.add.group();
        this.diamondGroup = this.add.group();
        this.checkpoints = this.add.group(this.checkpoints);

        this.coins.forEach(obj => {
            obj.id = `coin_${Math.round(obj.x)}_${Math.round(obj.y)}`; // e.g., 'coin_32_240'
            this.coinGroup.add(obj); // Add to coin group
        });
        this.diamonds.forEach(obj => {
            obj.id = `diamond_${Math.round(obj.x)}_${Math.round(obj.y)}`; // e.g., 'diamond_32_240'
            obj.defaultY = obj.y; // Store default Y position for bobbing
            this.diamondGroup.add(obj); // Add to diamond group
        });

        const collected = new Set(JSON.parse(localStorage.getItem('collectedItems')));
        if (collected && collected.size > 0) {
            [this.coins, this.diamonds].forEach(group => {
                group.forEach(obj => {
                    if (collected.has(obj.id)) {
                        obj.destroy(); // Destroy the object
                    }
                });
            });
        }

        const checkpointX = localStorage.getItem('checkpointX');
        const checkpointY = localStorage.getItem('checkpointY');
        if (checkpointX && checkpointY) {
            this.checkpoints.getChildren().forEach(flag => {
                if (flag.x == checkpointX && flag.y == checkpointY) {
                    this.spawnPoint = [flag.x, flag.y]; // Update spawn point to this flag 
                    this.tweens.add({
                        targets: flag,
                        y: flag.y - 8,
                        duration: 700,
                        ease: 'Linear'
                    });
                    flag.raised = true; // Mark this flag as raised
                }
            });
        }

        // TODO: Add coin collision handler
        // Handle collision detection with coins
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (player, coin) => {
            coin.body.enable = false;

            // Play coin sound
            this.sound.play('coinSound', {
                volume: 0.5,
                loop: false
            });

            // Tween coin to disappear
            this.tweens.add({
                targets: coin,
                y: coin.y - 15,
                alpha: 0,
                duration: 600,
                ease: 'Back.easeOut',
                onComplete: () => coin.destroy()
            });
            this.updateScore(1); // increment score

            const coinId = `coin_${Math.round(coin.x)}_${Math.round(coin.y)}`;
            this.collectedItems = JSON.parse(localStorage.getItem('collectedItems'));
            this.collectedItems = new Set(this.collectedItems || []); // Initialize if null

            this.collectedItems.add(coinId); // e.g., 'coin_32_240'

            // Save to localStorage
            localStorage.setItem('collectedItems', JSON.stringify([...this.collectedItems]));
        });
        this.physics.add.overlap(my.sprite.player, this.diamondGroup, (player, diamond) => {
            diamond.body.enable = false;

            // Play diamond sound
            this.sound.play('diamondSound', {
                volume: 0.5,
                loop: false
            });

            // Tween diamond to disappear
            this.tweens.killTweensOf(diamond);  // Cancel bob
            this.tweens.add({
                targets: diamond,
                y: diamond.y - 15,
                alpha: 0,
                duration: 600,
                ease: 'Back.easeOut',
                onComplete: () => diamond.destroy()
            });
            this.updateScore(5); // increment score

            const diamondId = `diamond_${Math.round(diamond.x)}_${Math.round(diamond.defaultY)}`; // Use defaultY for bobbing
            this.collectedItems = JSON.parse(localStorage.getItem('collectedItems'));
            this.collectedItems = new Set(this.collectedItems || []); // Initialize if null

            this.collectedItems.add(diamondId); // e.g., 'coin_32_240'

            // Save to localStorage
            localStorage.setItem('collectedItems', JSON.stringify([...this.collectedItems]));
        });
        this.physics.add.overlap(my.sprite.player, this.checkpoints, (player, flag) => {
            // Check if at new checkpoint
            if (this.spawnPoint[0] != flag.x && this.spawnPoint[1] != flag.y) {
                this.spawnPoint = [flag.x, flag.y]; // Update spawn point to this flag
                localStorage.setItem('checkpointX', flag.x);
                localStorage.setItem('checkpointY', flag.y);
                this.tweens.add({
                    targets: flag,
                    y: flag.y - 8,
                    duration: 700,
                    ease: 'Linear'
                });
                flag.raised = true; // Mark this flag as raised
                this.checkpointSound.play(); // Play checkpoint sound
                this.checkpoints.getChildren().forEach(f => {
                    if (f !== flag && f.raised) {
                        // Lower all other flags
                        this.tweens.add({
                            targets: f,
                            y: f.y + 8,
                            duration: 700,
                            ease: 'Linear'
                        });
                        f.raised = false; // Mark this flag as lowered
                    }
                });
            }

            // If at end of level, trigger game over
            if (flag.data.values.endFlag) {
                if (!this.isGameOver) {
                    this.isGameOver = true; // prevent multiple triggers
                    console.log("You reached the end! Final Score: " + this.registry.get('playerScore'));
                    this.gameOver("You win!");

                }
            }
        });

        // Play animations
        this.coinGroup.getChildren().forEach(coin => {
            coin.anims.play('coinSpin');
        });
        this.checkpoints.getChildren().forEach(flag => {
            flag.anims.play('flagWave');
        });

        // Diamond bob
        this.diamondGroup.getChildren().forEach(diamond => {
            this.tweens.add({ 
                targets: diamond, 
                y: diamond.y - 3, 
                duration: 400, 
                yoyo: true, 
                repeat: -1, 
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 500) // random stagger up to 300ms
            });
        });

    }
    
    createBubbles(minX, maxX, minY, maxY) {
            my.vfx.bubbles = this.add.particles(0, 0, 'kenny-particles', {
            frame: 'light_02.png',
            x: { min: minX, max: maxX },
            y: { min: minY, max: maxY },
            lifespan: { min: 1000, max: 1500 },
            speedY: { min: -30, max: -60 },   // Float upward
            gravityY: 0,                      // Optional: override global gravity
            scale: { start: 0.03, end: 0.008 }, // Shrink as it rises
            alpha: { start: 1, end: 1 },      // Fade out
            quantity: 2,
            frequency: 75,                   // How often to spawn bubbles
            angle: { min: -5, max: 5 },  // slight drift
            rotate: { start: 0, end: 360 }, // optional spin
            blendMode: 'ADD',
            duration: -1, // Loop indefinitely
        });
    }

    addMovingPlatforms() {
        const objects = this.map.getObjectLayer('MovingPlatforms').objects;
        const tileset = this.map.tilesets[0]; // or use the name if multiple
        const firstGid = tileset.firstgid;

        objects.forEach(obj => {
            const frameIndex = obj.gid - firstGid; // Calculate the frame index
            const platform = this.add.tileSprite(obj.x, obj.y, obj.width, obj.height, 'tilemap_sheet', frameIndex);
            platform.setOrigin(0, 1); // Set origin to top-left

            // Enable collision handling
            this.physics.add.existing(platform, true);
            this.physics.add.collider(my.sprite.player, platform);

            // Extract properties
            const props = {};
            if (obj.properties) {
                obj.properties.forEach(p => props[p.name] = p.value);
            }

            // Movement config from Tiled
            //const axis = props.axis || 'x';
            const axis = props.axis || 'y'; // Default to vertical movement
            const range = props.range || 100;
            const speed = props.speed || 50;
            const reverse = props.reverse || false;

            // Calculate tween duration
            const duration = Math.abs((range / speed) * 1000);

            // Determine target position
            const targetPos = (axis === 'x')
                ? { x: platform.x + (reverse ? -range : range) }
                : { y: platform.y + (reverse ? range : -range) }; // down if reversed


            // Tween to move platform
            this.tweens.add({
                targets: platform,
                ...targetPos,
                duration,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    platform.body.updateFromGameObject(); // Required for static bodies
                },
                onUpdate: () => {
                    const dx = platform.x - platform.prevX;
                    const dy = platform.y - platform.prevY;

                    const player = my.sprite.player;
                    const pBody = player.body;
                    const platBody = platform.body;

                    // Only apply movement if player is grounded on platform
                    const isGrounded =
                        pBody.blocked.down || pBody.touching.down;
                    const isTouchingPlatform =
                        Phaser.Geom.Intersects.RectangleToRectangle(pBody, platBody);

                    if (isGrounded && isTouchingPlatform) {
                        player.x += dx;
                        player.y += dy;
                    }

                    // Update physics body and position tracker
                    platform.body.updateFromGameObject();
                    platform.prevX = platform.x;
                    platform.prevY = platform.y;
                }
            });
        });
    }

    /**************************************************************************************************************************  
    -------------------------------------------------- END OF GAME FUNCTIONS -------------------------------------------------- 
    **************************************************************************************************************************/

    gameOver(text="Game Over") {
        this.gameOverText.setText(text); // Set the text
        this.gameOverText.setVisible(true); // Show the text

        for (let rect of this.rects) {
            rect.setVisible(true); // Show the overlay
        }

        for (let button of this.buttons) {
            // Show buttons and enable interaction
            button.setVisible(true);
            button.setInteractive(true); 
        }

        this.inputLocked = true;

        // Play level complete sound
        if (!this.levelCompleteSound.isPlaying) {
            this.registry.get('bgMusic').setVolume(0.1); // Lower background music volume
            this.levelCompleteSound.play();
        }
    }

    restartGame(restart) {
        
        this.gameOverText.setVisible(false); // Hide the text

        for (let rect of this.rects) {
            rect.setVisible(false); // Hide the overlay
        }

        for (let button of this.buttons) {
            button.setVisible(false); // Hide all buttons
            button.setInteractive(false); // Disable interaction
        }

        let playerScore = this.registry.get('playerScore');
        // Check if the player score is greater than the high score
        if (playerScore > parseInt(localStorage.getItem('highScore')) || !localStorage.getItem('highScore')) {
            localStorage.setItem('highScore', playerScore);
        }

        this.levelCompleteSound.stop(); // Stop level complete sound
        this.registry.get('bgMusic').setVolume(0.4); // Reset background music volume

        if (restart) {
            this.registry.set('playerScore', 0); // Reset score
            let highScore = parseInt(localStorage.getItem('highScore')) || 0; // Save high score
            localStorage.clear(); // Clear local storage
            localStorage.setItem('highScore', highScore); // Reset high score
            this.scene.stop('level1');
            this.scene.start('level1');
        } else {
            this.inputLocked = false;
            this.time.delayedCall(5000, () => { // wait 5 seconds before resetting so player leaves flag
                this.isGameOver = false; // Reset game over state
            });

        }
    }

    /************************************************************************************************************* 
    -------------------------------------------------- MOVEMENT -------------------------------------------------- 
    *************************************************************************************************************/

    handleMovement(groundedNow) {
        let isWalking = false; // Track if the player is walking
        if (!this.inputLocked) {
            if(cursors.left.isDown || this.aKey.isDown) {
                if (my.sprite.player.body.velocity.x > 0) my.sprite.player.setVelocityX(my.sprite.player.body.velocity.x / 4);
                my.sprite.player.setAccelerationX(-this.ACCELERATION);
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);
                // Particle following
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, my.sprite.player.displayHeight/2-15, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                } 
                isWalking = true;

            } else if(cursors.right.isDown || this.dKey.isDown) {
                if (my.sprite.player.body.velocity.x < 0) my.sprite.player.setVelocityX(my.sprite.player.body.velocity.x / 4);
                my.sprite.player.setAccelerationX(this.ACCELERATION);
                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);
                // Particle following
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, my.sprite.player.displayHeight/2-15, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                }
                isWalking = true;

            } else {
                // Set acceleration to 0 and have DRAG take over
                my.sprite.player.setAccelerationX(0);
                my.sprite.player.setDragX(this.DRAG);
                //my.sprite.player.setVelocityX(0); // stop horizontal movement
                my.sprite.player.anims.play('idle');
                my.vfx.walking.stop();
            } 
        } else {
            // Set acceleration to 0 and have DRAG take over
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);
            //my.sprite.player.setVelocityX(0); // stop horizontal movement
            my.sprite.player.anims.play('idle');
            my.vfx.walking.stop();
        }
        return isWalking; // Return whether the player is walking
    }

    /****************************************************************************************************************** 
    -------------------------------------------------- JUMPING + VFX -------------------------------------------------- 
    ******************************************************************************************************************/

    handleJump(groundedNow, delta) {
               // Track how many consecutive frames the player is grounded
        if (groundedNow) {
            this.coyoteTime = this.COYOTE_DURATION;
            this.hasJumped = false;
        } else {
            this.groundedFrames = 0;
            this.coyoteTime -= delta;
        }

        if (Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.jumpBufferRemaining = this.JUMP_BUFFER_DURATION;
        else this.jumpBufferRemaining -= delta; // decrement jump buffer time

        // player jump
        // note that we need body.blocked rather than body.touching b/c the former applies to tilemap tiles and the latter to the "ground"
        if(!groundedNow) {
            my.sprite.player.anims.play('jump');
        }
        if(!this.inputLocked && this.coyoteTime > 0 && this.jumpBufferRemaining > 0 && !this.hasJumped) {
            this.hasJumped = true; // set jump flag to true
            this.coyoteTime = 0; // reset coyote time
            this.jumpBufferRemaining = 0; // reset jump buffer time
            my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);

            // Play jump vfx
            my.vfx.jumping.x = my.sprite.player.x; // center the particle on the player
            my.vfx.jumping.y = my.sprite.player.y + my.sprite.player.displayHeight - 20; // center the particle on the player
            my.vfx.jumping.start();
            this.time.delayedCall(10, () => {
                my.vfx.jumping.stop(); // stop the jump vfx
            });

            // Play jump sound
            this.jumpSound.play();

            // Stretch and squash effect
            my.sprite.player.setScale(1.2, 0.8);  // stretch up, squash wide

            this.tweens.add({
                targets: my.sprite.player,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Sine.easeOut'
            });

        }

        // Cut jump short if player releases key while still rising
        if (my.sprite.player.body.velocity.y < 0 && !(cursors.up.isDown || this.spaceKey.isDown)) {
            // Cut the jump
            my.sprite.player.setVelocityY(Math.max(my.sprite.player.body.velocity.y, this.JUMP_CUTOFF_VELOCITY));
        }
    }

    /************************************************************************************************************* 
    -------------------------------------------------- JUCINESS -------------------------------------------------- 
    *************************************************************************************************************/

    movementSFX(delta, isWalking, groundedNow) {
        // Movement sfx
        this.walkStepCooldown -= delta;
        if (isWalking && groundedNow) {
            if (this.walkStepCooldown <= 0) {
                // Reset cooldown
                this.walkStepCooldown = this.STEP_INTERVAL;

                // Restart sound
                this.walkSound.stop(); // reset if already playing
                this.walkSound.play();

                // Reset volume to 0 and tween it in and out
                this.walkSound.setVolume(0.35);

                this.tweens.add({
                    targets: this.walkSound,
                    volume: 0,
                    duration: 300,
                    ease: 'Sine.easeInOut'
                });
            }
        }
    }

    landingVFX(groundedNow) {
        if (groundedNow && !this.wasGrounded) {
            // Trigger landing VFX only on landing
            my.vfx.landing.x = my.sprite.player.x;
            my.vfx.landing.y = my.sprite.player.y + my.sprite.player.displayHeight - 20;
            my.vfx.landing.start();
            this.time.delayedCall(10, () => {
                my.vfx.landing.stop(); // stop the jump vfx
            });

            // Play landing sound
            //this.jumpSound.play();

            // Stretch and squash effect
            my.sprite.player.setScale(0.8, 1.2);  // squash down

            this.tweens.add({
                targets: my.sprite.player,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Bounce.easeOut'
            });
        }
    }

    characterJuice(maxLeanAngle, maxSquash) {
        // Lean affect
        const velocityX = my.sprite.player.body.velocity.x;

        // Normalize velocity to [-1, 1] based on max speed
        const speedRatio = Phaser.Math.Clamp(velocityX / this.MAX_VELOCITY, -1, 1);

        // Lean the player
        my.sprite.player.setRotation(Phaser.Math.DegToRad(maxLeanAngle * speedRatio));

        // Slight horizontal squash (increase scaleX when leaning)
        my.sprite.player.setScale(1 - Math.abs(speedRatio) * (1 - maxSquash), my.sprite.player.scaleY); 
    }

    /*********************************************************************************************************************** 
    -------------------------------------------------- OFF MAP + SPAWNING -------------------------------------------------- 
    ***********************************************************************************************************************/

    handleRespawn() {
        this.respawning = true; // Set respawning flag
        // If dead, respawn at last check point
        my.sprite.player.setVelocity(0, 0); // reset velocity
        my.sprite.player.setAcceleration(0, 0); // reset acceleration
        my.sprite.player.setDrag(0, 0); // reset drag
        this.deadSound.play(); // Play death sound
        this.tweens.add({
            targets: my.sprite.player,
            alpha: 0,
            scale: 0.1,
            duration: 500,
            repeat: 0,
            onComplete: () => {
                my.sprite.player.alpha = 1; // reset alpha
                my.sprite.player.setScale(1); // reset scale
                this.playerDead = false; // reset dead state

                // Disable collision right after respawn
                [this.flyingEnemyGroup].forEach(group => {
                    group.getChildren().forEach(enemy => enemy.body.checkCollision.none = true);
                });
                my.sprite.player.setPosition(this.spawnPoint[0], this.spawnPoint[1]); // respawn at last checkpoint
            }
        });

        this.inputLocked = true;
        this.time.delayedCall(750, () => {
            this.inputLocked = false;
            this.respawning = false; // Reset respawning flag
        });
        this.time.delayedCall(3000, () => { // Reenable collision after respawn
            [this.flyingEnemyGroup].forEach(group => {
                    group.getChildren().forEach(enemy => enemy.body.checkCollision.none = false);
            });
        });
    }

    updateSafeGround(groundedNow) {
        // If player is grounded and on safe ground, update last safe position
        if (groundedNow) {
            const tile = this.groundLayer.getTileAtWorldXY(my.sprite.player.x, my.sprite.player.y + my.sprite.player.height / 2);
            if (tile && tile.properties.safeGround) {
                this.lastSafePosition = [my.sprite.player.x, my.sprite.player.y];
            }
        }
    }

    saveGame() {
        // Save to localStorage
        localStorage.setItem('savedCheckpoint', JSON.stringify({
            scene: this.scene.key,
            spawnX: this.lastSafePosition[0],
            spawnY: this.lastSafePosition[1],
            score: this.registry.get('playerScore'),
            timestamp: Date.now()
        }));
    }
}