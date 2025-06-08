class Menu extends Phaser.Scene {
    constructor() {
        super('menu');
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Title
        this.add.bitmapText(centerX, centerY - 100, 'myFont', 'Forest of Advantis', 24).setOrigin(0.5);

        // Helper function to create buttons with highlight background
        const makeButton = (text, y, callback) => {
            const label = this.add.bitmapText(centerX, y, 'myFont', text, 16).setOrigin(0.5);

            const padding = 4; // Padding around the text
            const width = label.width + padding * 2;
            const height = label.height + padding * 2;

            const bg = this.add.rectangle(label.x, label.y, width, height, 0xffff00, 0.3);
            bg.setVisible(false);

            label.setInteractive({ useHandCursor: true })
                .on('pointerdown', callback)
                .on('pointerover', () => bg.setVisible(true))
                .on('pointerout', () => bg.setVisible(false));
        };

        // Start Button
        makeButton('[ Start Game ]', centerY, () => this.scene.start('scene1'));

        // Quit Button
        makeButton('[ Quit Game ]', centerY + 40, () => {
            window.close();
            window.open('', '_self')?.close();
        });
    }
}
