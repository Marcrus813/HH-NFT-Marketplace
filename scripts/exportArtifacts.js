const fs = require("fs");
const path = require("path");

const exportContractArtifacts = async (taskArgs) => {
    const { chainId, dir } = taskArgs;
    if (typeof chainId === undefined || typeof dir === undefined) {
        console.log("Invalid param");
        return;
    }
    console.log(
        `Exporting contract artifacts for chain ID: ${chainId} to destination ${dir}`
    );
    const addressSourceDir = path.join(
        __dirname,
        `../ignition/deployments/chain-${chainId}/deployed_addresses.json`
    );
    const artifactSourceDir = path.join(
        __dirname,
        `../ignition/deployments/chain-${chainId}/artifacts/NftMarketplaceModule#NftMarketplace.json`
    );

    const targetDir = `${dir}/assets/artifacts`;

    try {
        fs.mkdirSync(targetDir, { recursive: true });

        const addressData = JSON.parse(
            fs.readFileSync(addressSourceDir, "utf-8")
        );
        const artifactData = JSON.parse(
            fs.readFileSync(artifactSourceDir, "utf-8")
        );

        fs.writeFileSync(
            path.join(targetDir, "addresses.js"),
            `const contractAddresses = ${JSON.stringify(addressData, null, 4)};\nmodule.exports = { contractAddresses };`
        );
        fs.writeFileSync(
            path.join(targetDir, "artifacts.js"),
            `const contractArtifact = ${JSON.stringify(artifactData, null, 4)};\nmodule.exports = { contractArtifact };`
        );

        console.log(
            `Exported artifacts for chain: "${chainId}" to "${targetDir}"`
        );
    } catch (e) {
        console.error(`Error: ${e}`);
    }
};

module.exports = {
    exportContractArtifacts
};
