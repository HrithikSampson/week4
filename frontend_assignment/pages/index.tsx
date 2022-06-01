import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers ,utils} from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { useForm } from "react-hook-form";

import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [gret, setGret] = React.useState("")
    const { register, handleSubmit } = useForm();
    React.useEffect(()=>{
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider)

        //console.log("Start Listening");
        const contractOwner = contract.connect(provider.getSigner())
        // contractOwner.on("NewGreeting", (result) => {
        //     console.log("Start Greet");
        //     let greetStr = utils.parseBytes32String(result)
        //     setGret(greetStr)
        //     console.log('greet:',greetStr)
        // })
         // const filter = {
         //        address: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
         //        topics: [
         //            // the name of the event, parnetheses containing the data type of each event, no spaces
         //            utils.id("NewGreeting(bytes32 greeting)")
         //        ]
         //    }

         //    provider.on(filter, (greeting: any) => {
         //        console.log('greet:',greeting)
         //        console.log("here")
         //    })

        provider.on("NewGreeting", (greeting:any) => {
            //const newgreet = utils.formatBytes32String(greeting);
            console.log("greet:",greeting);
            setGret(greeting);
        })
    });
    async function greet(data:any) {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any
        await provider.request({ method: "eth_requestAccounts" })
        console.log("provider:",provider)
        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")
        console.log(message)
        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        console.log(identity)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)
        console.log('proof:' , proof,'\npublicSignals:',publicSignals)
        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        console.log('response:',response);
        setGret(greeting)
        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>
                    <form onSubmit={handleSubmit(greet)}>
                        <div>
                            <label className={styles.label}> Name </label>
                            <input className={styles.inp}  {...register("name", { required: true, maxLength: 50 })} />
                        </div>

                        <div>
                            <label className={styles.label}> Age </label>
                            <input className={styles.inp}  type="number" {...register("age", { min: 18, max: 99 })} />
                        </div>
                        <div>
                            <label className={styles.label}> Address </label>
                            <input className={styles.inp}  {...register("address", { required: true, maxLength: 50 })}/>
                        </div>


                        <input style={{"margin":"auto"}}  type="submit" className={styles.button}/>
                    </form>
                <Box
                      component="form"
                      sx={{
                        '& .MuiTextField-root': { m: 1, width: '80ch' },
                      }}
                      noValidate
                      autoComplete="off"
                    >
                <TextField
                  id="outlined-multiline-static"
                  label="Incoming Greeting"
                  multiline
                  rows={4}
                  value={gret}
                />
                </Box>
            </main>
        </div>
    )
}
