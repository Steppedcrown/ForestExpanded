class PauseOverlay extends Phaser.Scene {
    constructor() {
        super('PauseOverlay');
    }

    init(data) {
        this.gameSceneKey = data.gameSceneKey; // <-- Store the scene key properly
    }

    create() {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Dim background
        this.add.rectangle(0, 0, width, height, 0x000000, 0.5)
            .setOrigin(0)
            .setScrollFactor(0);

        // Pause text
        this.add.bitmapText(centerX, centerY - 60, 'myFont', 'Game Paused', 24)
            .setOrigin(0.5);

        // High Score Display
        this.displayHighScore = this.add.bitmapText(50, 50, 'myFont', 'High Score: ' + (parseInt(localStorage.getItem('highScore')) || 0), 16);

        // Click sfx
        this.click = this.sound.add('uiClick', {
            volume: 0.2
        });

        // Helper function to create buttons with highlight background
        const makeButton = (text, y, callback) => {
            const label = this.add.bitmapText(centerX, y, 'myFont', text, 16).setOrigin(0.5);

            const padding = 4;
            const width = label.width + padding * 2;
            const height = label.height + padding * 2;

            const bg = this.add.rectangle(label.x, label.y, width, height, 0xffff00, 0.3);
            bg.setVisible(false);

            label.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.click.play()) // Play button click sound
                .on('pointerdown', callback)
                .on('pointerover', () => bg.setVisible(true))
                .on('pointerout', () => bg.setVisible(false));
        };

        // Resume button
        makeButton('[ Resume ]', centerY + 80, () => {
            this.input.enabled = false;

            this.tweens.add({
                targets: this.cameras.main,
                alpha: 0,
                duration: 800,
                ease: 'Linear',
                onComplete: () => {
                    this.scene.stop();                 // Stop pause overlay
                    this.scene.resume(this.gameSceneKey); // Resume the paused game scene
                    this.scene.get(this.gameSceneKey).inputLocked = false;   // Unlock input
                }
            });
        });

        // Resume with esc key
        this.input.keyboard.on('keydown-ESC', () => {
            this.input.enabled = false;
            this.click.play();

            this.tweens.add({
                targets: this.cameras.main,
                alpha: 0,
                duration: 800,
                ease: 'Linear',
                onComplete: () => {
                    this.scene.stop();                 // Stop pause overlay
                    this.scene.resume(this.gameSceneKey); // Resume the paused game scene
                    this.scene.get(this.gameSceneKey).inputLocked = false;   // Unlock input
                }
            });
        });

        // Exit button
        makeButton('[ Return to Menu ]', centerY + 120, () => {
            this.scene.stop();                         // Stop this overlay
            this.scene.launch('menu');                  // Go to main menu
        });
    }
}
