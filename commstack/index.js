import {
    OPCUAClient,
    MessageSecurityMode, SecurityPolicy,
    AttributeIds,
    makeBrowsePath,
    ClientSubscription,
    TimestampsToReturn,
    ClientMonitoredItem, DataType,
} from "node-opcua";

import express from 'express';
const app = express();

const connectionStrategy = {
    initialDelay: 1000,
    maxRetry: 1
}
const options = {
    applicationName: "MyClient",
    connectionStrategy: connectionStrategy,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpoint_must_exist: false,
};
const client = OPCUAClient.create(options);
// const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

console.log('Started');

let plcList = [
    {name: 'PLC_1', ip: '192.168.0.242', state: true}
];

async function main(sequence, ip) {
    try {
        const plc = plcList.find((e) => {
            return e.ip === ip;
        });
        const plcIndex = plcList.indexOf(plc);
        plc.state = false;
        plcList[plcIndex] = plc;

        // 192.168.0.242
        const endpointUrl = 'opc.tcp://' + ip + ':4840';
        // step 1 : connect to
        console.log('Connecting');
        await client.connect(endpointUrl);
        console.log("connected !");

        // step 2 : createSession
        const session = await client.createSession();
        console.log("session created !");

        // // step 3 : browse
        // const browseResult = await session.browse("RootFolder");
        // //
        // console.log(browseResult.references[0]);
        // let dataValue2 = await session.readVariableValue("ns=3;s=\"Cylinder_A_Extend\"");
        // console.log(" value = ", dataValue2.toString());

        let previous = {actuator: '', action: ''};
        let state = {ret: null, ext: null};

        const tVar = [{
            nodeId: 'ns=3;s=\"T_VARIABLE\"',
            attributeId: AttributeIds.Value,
            indexRange: null,
            value: {
                value: {
                    dataType: "Int16",
                    value: 3
                }
            }
        }];

        await session.write(tVar, (err, res) => {
            console.log('Executing');
            console.log(err)
            console.log(res)
        });

        for(let i = 0; i < sequence.length; i++) {
            await session.write(retract(sequence[i][0]), (err, res) => {
                console.log('Executing');
            });
        }

        await sleep(300);

        for(let i = 0; i < sequence.length; i++) {
            const timerMatch = sequence[i].match(/((((T\+)?(([0-9].[0-9]+)|([1-9]+[0-9]*)|([1-9]+[0-9]*.[0-9]+)))S)|TS)*/i);
            if (timerMatch && timerMatch[0] !== '') {
                let time = 0;
                if(sequence[i].search('T') !== -1) {
                    if(sequence[i].search(/\+/) !== -1) {
                        // Read T and add number
                        const tValue = (await session.readVariableValue("ns=3;s=\"T_VARIABLE\"")).value.value;
                        time = (parseInt(sequence[i].replaceAll('T', '').replaceAll('+', '').replaceAll('S', '')) + tValue) * 1000;
                        console.log(time);
                    } else {
                        time = (await session.readVariableValue("ns=3;s=\"T_VARIABLE\"")).value.value;
                    }
                } else {
                    time = parseInt(sequence[i].replaceAll('T', '').replaceAll('+', '').replaceAll('S', '')) * 1000;
                }


                await sleep(time);
                continue;
            }

            if(previous.actuator && previous.actuator) {
                state.ext = (await session.readVariableValue("ns=3;s=\"Sensor_" + previous.actuator + "_Extended\"")).value.value;
                state.ret = (await session.readVariableValue("ns=3;s=\"Sensor_" + previous.actuator + "_Retracted\"")).value.value;
            }


            let action = [];

            if(previous.action === '-') {
                while(!state.ret){
                    state.ext = (await session.readVariableValue("ns=3;s=\"Sensor_" + previous.actuator + "_Extended\"")).value.value;
                    state.ret = (await session.readVariableValue("ns=3;s=\"Sensor_" + previous.actuator + "_Retracted\"")).value.value;
                }
            } else if(previous.action === '+') {
                while(!state.ext){
                    state.ext = (await session.readVariableValue("ns=3;s=\"Sensor_" + previous.actuator + "_Extended\"")).value.value;
                    state.ret = (await session.readVariableValue("ns=3;s=\"Sensor_" + previous.actuator + "_Retracted\"")).value.value;
                }
            }

            if(sequence[i][1] === '-') {
                action = retract(sequence[i][0]);
            } else if(sequence[i][1] === '+') {
                action = extend(sequence[i][0]);
            }

            await session.write(action, (err, res) => {
            });

            previous.actuator = sequence[i][0];
            previous.action = sequence[i][1];

            // await sleep(500);
        }

        // for(let i = 0; i < 5; i++) {
        //     await session.write(retract('A'), (err, res) => {
        //         console.log('Retracting');
        //     });
        //
        //     await sleep(1000);
        //
        //     await session.write(extend('A'), (err, res) => {
        //         console.log('Extending');
        //     });
        //     await sleep(1000);
        // }


        // session.dataValue2 = await session.readVariableValue("ns=3;s=\"Cylinder_A_Extend\"");


        // close session
        await session.close();

        // disconnecting
        await client.disconnect();
        console.log("done !");
        plc.state = true;
        plcList[plcIndex] = plc;

    } catch (err) {
        console.log("An error has occured : ", err);
    }
}

app.get('/sequence/:sequence/:ip', async (req, res) => {
    let sequence = req.params.sequence.toUpperCase().replaceAll(/\s/g, "").split(',');
    let ip = req.params.ip;
    const plc = plcList.find((e) => {return e.ip === ip});
    if(plc && plc.state) {
        main(sequence, ip);
        res.send('Executing');
    } else {
        res.send('Chosen PLC is currently busy!');
    }
});

app.listen(3005);


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function retract(cylinder) {
    return [{
        nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Extend\"',
        attributeId: AttributeIds.Value,
        indexRange: null,
        value: {
            value: {
                dataType: "Boolean",
                value: false
            }
        }
    },
        {
            nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Retract\"',
            attributeId: AttributeIds.Value,
            indexRange: null,
            value: {
                value: {
                    dataType: "Boolean",
                    value: true
                }
            }
        }
    ]
}

function extend(cylinder) {
    return [{
        nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Retract\"',
        attributeId: AttributeIds.Value,
        indexRange: null,
        value: {
            value: {
                dataType: "Boolean",
                value: false
            }
        }
    },
        {
        nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Extend\"',
        attributeId: AttributeIds.Value,
        indexRange: null,
        value: {
            value: {
                dataType: "Boolean",
                value: true
            }
        }
    }
    ]
}