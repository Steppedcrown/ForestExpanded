class Menu extends Phaser.Scene {
    constructor() {
        super('menu');
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Title
        this.add.bitmapText(centerX, centerY - 100, 'myFont', 'Forest of Advantis', 24).setOrigin(0.5);

        // High Score Display
        this.displayHighScore = this.add.bitmapText(50, 50, 'myFont', 'High Score: ' + (parseInt(localStorage.getItem('highScore')) || 0), 16);

        // Click sfx
        this.click = this.sound.add('uiClick', {
            volume: 0.2
        });

        // Helper function to create buttons with highlight background
        const makeButton = (text, y, callback) => {
            const label = this.add.bitmapText(centerX, y, 'myFont', text, 16).setOrigin(0.5);

            const padding = 4; // Padding around the text
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

        // Start Button
        makeButton('[ Start Game ]', centerY, () => this.scene.start('level1'));

        // Quit Button
        makeButton('[ Quit Game ]', centerY + 40, () => {
            window.close();
            window.open('', '_self')?.close();
        });

        // Reset browser cache
        this.input.keyboard.on('keydown-P', (event) => {
            localStorage.setItem('highScore', 0);
        }, this);
    }
}
