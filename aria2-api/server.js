const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');  // Import cors module
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Use cors middleware to enable CORS
app.use(cors());
app.use(bodyParser.json());

app.post('/download', (req, res) => {
    const url = req.body.url;
    var directory = req.body.directory;
    const filename = req.body.filename; // User-specified filename

    if (!url) {
        return res.status(400).send('No URL provided');
    }

    if (!directory) {
        return res.status(400).send('No directory provided');
    }
    
    if (!filename) {
        return res.status(400).send('No filename provided');
    }

    const comfyUIDir = path.resolve(__dirname + '/../../../');
    const safePath = path.resolve(comfyUIDir + '/' + directory);

    directory = comfyUIDir + '/' + directory;
    console.log("Safe Path: " + safePath)
    console.log("Directory: " + directory)
    
    if (!safePath.startsWith(directory)) {
        return res.status(400).send('Invalid directory path');
    }
    if (!fs.existsSync(safePath)) {
        fs.mkdirSync(safePath, { recursive: true });
    }


    const aria2cCommand = `aria2c --dir="${safePath}" --out="${filename}" "${url}"`;

    // Execute aria2c command and wait for it to finish
    new Promise((resolve, reject) => {
        const downloadProcess = exec(aria2cCommand);

        downloadProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        downloadProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        downloadProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(`aria2c process exited with code ${code}`);
            }
        });
    })
    .then(() => {
        res.send(`SUCCESS! Model downloaded to ${directory}`);
    })
    .catch((error) => {
        res.status(500).send(`ERROR! Download failed: ${error}`);
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
