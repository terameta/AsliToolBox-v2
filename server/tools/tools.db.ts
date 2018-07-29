import { Pool, createPool, FieldInfo } from 'mysql';
import { RealtimeDB } from './tools.rtdb';
import { MysqlConfig } from 'shared/models/systemconfig';

export class DB {
	public pool: Pool;
	public rtdb: RealtimeDB;

	constructor( private dbConfig: MysqlConfig, serverid: number ) {
		this.pool = createPool( {
			connectionLimit: 10,
			queueLimit: 0,
			host: dbConfig.host,
			port: dbConfig.port,
			user: dbConfig.user,
			password: dbConfig.pass,
			database: dbConfig.db
		} );
		if ( process.env.isWorker === 'true' ) {
			this.rtdb = new RealtimeDB( dbConfig, serverid );
		}
	}

	public query = <T>( queryToExecute: string, queryArguments?: any ): Promise<{ tuples: T[], fields: FieldInfo[] }> => {
		return new Promise( ( resolve, reject ) => {
			if ( queryArguments !== undefined ) {
				this.pool.query( queryToExecute, queryArguments, ( err, tuples: T[], fields ) => {
					if ( err ) {
						reject( err );
					} else {
						resolve( { tuples, fields } );
					}
				} );
			} else {
				this.pool.query( queryToExecute, ( err, tuples: T[], fields ) => {
					if ( err ) {
						reject( err );
					} else {
						resolve( { tuples, fields } );
					}
				} );
			}
		} );
	}
	public queryOne = async <T>( queryToExecute: string, queryArguments?: any ): Promise<{ tuple: T, fields: FieldInfo[] }> => {
		const { tuples, fields } = await this.query<T>( queryToExecute, queryArguments );
		if ( tuples.length !== 1 ) throw new Error( 'Wrong number of records. 1 expected' );
		return { tuple: tuples[0], fields };
	}
}
