import { Connection, Keypair, SystemProgram, LAMPORTS_PER_SOL, TransactionMessage } from '@solana/web3.js';
import { airdrop } from 'functions';
import * as multisig from 'squads-multisig';

const connection = new Connection("http://localhost:8899", "confirmed");

const createKey = Keypair.generate();
const creator = Keypair.generate();
const secondMember = Keypair.generate();

const multisigPda = multisig.getMultisigPda({
    createKey: createKey.publicKey,
})[0];

const members = [{
    key: creator.publicKey,
    permissions: multisig.types.Permissions.all(),
},
{
    key: secondMember.publicKey,
    permissions: multisig.types.Permissions.fromPermissions([multisig.types.Permission.Vote]),
},
];

const createMultisig = async(members: multisig.types.Member[]) => {
    await airdrop(connection, creator.publicKey, 10 * LAMPORTS_PER_SOL);

    const multisigSignature = await multisig.rpc.multisigCreate({
        connection,
        createKey,
        creator,
        multisigPda,
        configAuthority: null,
        timeLock: 0,
        members,
        threshold: 2,
    });

    console.log("Multisig created: ", multisigSignature);
};

const transactionProposal = async() => {

    const [vaultPda, vaultBump] = multisig.getVaultPda({
        multisigPda,
        index: 0,
    });

    await airdrop(connection, vaultPda, LAMPORTS_PER_SOL * 10);
    await airdrop(connection, secondMember.publicKey, LAMPORTS_PER_SOL * 10);

    const instruction = SystemProgram.transfer({
        fromPubkey: vaultPda,
        toPubkey: creator.publicKey,
        lamports: 1 * LAMPORTS_PER_SOL
    });

    const transferMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [instruction],
    });

    console.log("\ncreate vault transaction\n");

    const transactionIndex = 1n;
    const signature1 = await multisig.rpc.vaultTransactionCreate({
        connection,
        feePayer: creator,
        multisigPda,
        transactionIndex,
        creator: creator.publicKey,
        vaultIndex: 1,
        ephemeralSigners: 0,
        transactionMessage: transferMessage,
        memo: "Transfer 0.1 SOL to creator"
    });
    await connection.confirmTransaction(signature1, "confirmed");
    console.log("Transaction created: ", signature1);

    const signature2 = await multisig.rpc.proposalCreate({
        connection,
        feePayer: secondMember,
        creator: secondMember,
        multisigPda,
        transactionIndex
    });
    await connection.confirmTransaction(signature2, "confirmed");
    console.log("Transaction proposal created: ", signature2);
}

const approveTransaction = async() => {
    const transactionIndex = 1n;
    const firstApprove =  await multisig.rpc.proposalApprove({
         connection,
         feePayer: creator,
         multisigPda,
         transactionIndex,
         member: creator,
    });
    await connection.confirmTransaction(firstApprove, "confirmed");
    console.log("First transaction approve : ", firstApprove);


     const secondApprove = await multisig.rpc.proposalApprove({
         connection,
         feePayer: creator,
         multisigPda,
         transactionIndex,
         member: secondMember
    });
    await connection.confirmTransaction(secondApprove, "confirmed");
    console.log("Second transaction approve : ", secondApprove);
}

const executeProposal = async() => {
    const transactionIndex = 1n;
    const [vaultPda, vaultBump] = multisig.getVaultPda({
        multisigPda,
        index: 0,
    });
    console.log("Transaction before execute\n");

    const signature = await multisig.rpc.vaultTransactionExecute({
        connection,
        feePayer: creator,
        multisigPda,
        transactionIndex,
        member: creator.publicKey,
    });
    await connection.confirmTransaction(signature, "confirmed");
    console.log("Transaction executed: ", signature);
}

const main = async() => {
    await createMultisig(members);
    await transactionProposal();
    await approveTransaction();
    await executeProposal();
}

main();