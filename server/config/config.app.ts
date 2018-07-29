import { DB } from '../tools/tools.db';
import { SystemConfig } from 'shared/models/systemconfig';
import { MainTools } from '../tools/tools.main';


import * as express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as multer from 'multer';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import * as helmet from 'helmet';
import * as logger from 'morgan';
import { ATApi } from '../api/api';
import { ATDataStoreInterest } from '../../shared/models/at.datastoreinterest';
import { Subscription } from 'rxjs';
import { Socket } from 'socket.io';
import { ATApiCommunication } from 'shared/models/at.socketrequest';

export function initiateApplicationWorker( refDB: DB, refConfig: SystemConfig ) {
	const app: express.Application = express();
	const server: http.Server = new http.Server( app );
	const io: socketio.Server = socketio( server );

	const mainTools = new MainTools( refDB.pool, refConfig );
	const api: ATApi = new ATApi( refDB, mainTools );

	const multerStorage = multer.memoryStorage();

	app.use( bodyParser.json( { limit: '100mb' } ) );
	app.use( bodyParser.text( { limit: '100mb' } ) );
	app.use( bodyParser.urlencoded( { extended: true, limit: '100mb' } ) );
	app.use( multer( { storage: multerStorage } ).any() );
	app.use( express.static( join( __dirname, '../../dist' ) ) );

	app.enable( 'trust proxy' );
	app.use( helmet() );
	app.use( helmet.noCache() );

	app.use( logger( 'short' ) );

	app.get( '*', ( req, res ) => {
		res.sendFile( join( __dirname, '../../dist/index.html' ) );
	} );

	setInterval( () => {
		refDB.query( 'INSERT INTO streams (name, type, environment, dbName, tableName, customQuery, tags, exports) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['deleteMe', 0, 0, 'dbName', 'tableName', 'customQuery', '', ''] );
	}, 30000 );

	setTimeout( () => {
		setInterval( () => {
			refDB.query( 'UPDATE streams SET dbName = ? WHERE name = ?', ['theDBName', 'deleteMe'] );
		}, 30000 );
	}, 10000 );

	setTimeout( () => {
		setInterval( () => {
			refDB.query( 'DELETE FROM streams WHERE name = ?', 'deleteMe' );
		}, 30000 );
	}, 20000 );


	io.on( 'connection', ( socket ) => {
		// console.log( 'a user connected' );
		// console.log( socket.client.id );
		const interests: ATDataStoreInterest[] = [];
		const changeSubscription: Subscription = refDB.rtdb.changes$.subscribe( ( changedTable: string ) => { handleChanges( changedTable, interests, socket, refDB ); } );
		// console.log( 'We have now subscribed to changes$ on rtdb' );
		// console.log( socket );
		socket.on( 'disconnect', () => {
			// console.log( 'user disconnected' );
			changeSubscription.unsubscribe();
		} );
		socket.on( 'communication', ( payload ) => {
			api.respond( payload, socket ).catch( console.log );
		} );
		socket.on( 'interest', ( payload ) => {
			handleInterests( interests, payload, socket, refDB );
		} );

	} );

	server.listen( refConfig.serverPort, () => {
		console.log( 'Server is now running on port ' + refConfig.serverPort );
	} );


}

const handleInterests = async ( interests: ATDataStoreInterest[], newInterests: ATDataStoreInterest[], socket: Socket, db: DB ) => {
	// console.log( 'Current Interests', interests );
	// console.log( 'New Interests', newInterests );
	newInterests.forEach( interest => {
		const toCompare = interestToString( interest );
		if ( !interests.map( e => JSON.stringify( e ) ).includes( toCompare ) ) {
			interests.push( interest );
			handleChanges( interest.concept, interests, socket, db );
		}
	} );
	interests = interests.filter( interest => {
		const toCompare = interestToString( interest );
		if ( !newInterests.map( interestToString ).includes( toCompare ) ) {
			return false;
		} else {
			return true;
		}
	} );
};

const handleChanges = async ( changedTable: string, interests: ATDataStoreInterest[], socket: Socket, db: DB ) => {
	if ( interests.filter( i => i.concept === changedTable ).length > 0 ) {
		const { tuples } = await db.query<any>( 'SELECT * FROM ' + changedTable );
		const packet: ATApiCommunication = <ATApiCommunication>{};
		packet.framework = changedTable;
		packet.action = 'refresh';
		packet.payload = {
			status: 'success',
			data: tuples
		};
		// console.log( 'We are at handleChanges', changedTable, '#Tuples:', tuples.length );
		socket.emit( 'communication', packet );
	}
};

const interestToString = ( interest: ATDataStoreInterest ) => {
	return JSON.stringify( { concept: interest.concept, id: interest.id || interest.id === 0 ? interest.id : undefined } );
};

// import * as express from 'express';
// import * as http from 'http';
// import * as path from 'path';
// import * as bodyParser from 'body-parser';
// import * as multer from 'multer';
// import * as helmet from 'helmet';
// import * as logger from 'morgan';
// import * as jwt from 'express-jwt';
// import * as socketio from 'socket.io';

// import { Application } from 'express';
// import { initializeRestApi } from '../api/api';
// import { MainTools } from '../tools/tools.main';
// import { DB } from '../tools/tools.db';

// export function initiateApplicationWorker( refDB: DB, refConfig: SystemConfig ) {
// 	const app: Application = express();
// 	const mainTools = new MainTools( refDB.pool, refConfig );

// 	const multerStorage = multer.memoryStorage();

// 	app.use( bodyParser.json( { limit: '100mb' } ) );
// 	app.use( bodyParser.text( { limit: '100mb' } ) );
// 	app.use( bodyParser.urlencoded( { extended: true, limit: '100mb' } ) );
// 	app.use( multer( { storage: multerStorage } ).any() );
// 	app.use( express.static( path.join( __dirname, '../../dist' ) ) );

// 	app.enable( 'trust proxy' );

// 	app.use( helmet() );
// 	app.use( helmet.noCache() );

// 	app.use( logger( 'short' ) );

// 	app.use( '/api', jwt( { secret: refConfig.hash } ).unless( { path: ['/api/auth/signin', /\/api\/dime\/secret\/givemysecret/i] } ) );
// 	// app.use( '/api/dime', jwt( { secret: refConfig.hash } ) );
// 	// app.use( '/api/log', jwt( { secret: refConfig.hash } ) );

// 	initializeRestApi( app, refDB, mainTools );

// 	app.set( 'port', 8000 );

// 	app.get( '*', ( req, res ) => {
// 		res.sendFile( path.join( __dirname, '../../dist/index.html' ) );
// 	} );

// 	const server: http.Server = app.listen( app.get( 'port' ), () => {
// 		console.log( 'Server is now running on port ' + app.get( 'port' ) );
// 	} );

// 	const io: socketio.Server = socketio( server );
// 	io.on( 'connection', ( socket ) => {
// 		console.log( socket );
// 		console.log( 'a user connected' );
// 	} );

// }
