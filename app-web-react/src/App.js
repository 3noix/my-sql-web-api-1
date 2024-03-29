import {useState, useEffect, useCallback} from 'react';
import styled from 'styled-components';
import Button from './Button';
import Table from './Table';
import FormLogin from './FormLogin';
import FormAddEdit from './FormAddEdit';
import useWebSocket from './useWebSocket';
import useMemorization from './useMemorization';
import useEntries from './useEntries';


const Root = styled.div`
	display: flex;
	flex-direction: row;
`;

const Section = styled.section`
	width: 50px;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: center;
`;

const Main = styled.main`
	width: calc(100% - 50px);
`;


let defaultModalData = {id: 0, description: "", number: 0};
// let count = 0;


export default function App() {
	// useEffect(() => {
	// 	count++;
	// 	console.log("render",count);
	// });

	const [login,            setLogin]            = useState("");
	const [modalLoginOpen,   setModalLoginOpen]   = useState(true);
	const [selectedEntryId,  setSelectedEntryId]  = useState(-1);
	const [modalAddEditOpen, setModalAddEditOpen] = useState(false);
	const [modalAddEditMode, setModalAddEditMode] = useState("");
	const [modalAddEditData, setModalAddEditData] = useState(defaultModalData);
	
	const {entries, setAllEntries, appendEntry, updateEntry, deleteEntry} = useEntries();


	const validatedLogin = useMemorization(login, modalLoginOpen);
	const wsConnecCond = (validatedLogin !== null && validatedLogin !== "");
	const host = (window.location.hostname.length > 0 ? window.location.hostname : "localhost");

	const onWsOpen = useCallback(() => {console.log("connected!");}, []);
	const onWsError = useCallback(error => {console.log("Error: " + error);}, []);
	const onWsClose = useCallback(() => {console.log("disconnected!");}, []);

	const onWsMessage = useCallback(dataStr => {
		let data = JSON.parse(dataStr);

		if (data.type === "insert") {appendEntry(data.entry);}
		else if (data.type === "update") {updateEntry(data.entry);}
		else if (data.type === "delete") {deleteEntry(data.id);}
		else if (Array.isArray(data)) {setAllEntries(data);}
		else if (data.type === "lock") {
			if (data.status !== "success") {
				alert(`Lock request failed:\n${data.msg}`);
				setModalAddEditOpen(false);
				setModalAddEditMode("");
				setModalAddEditData(defaultModalData);
			}
			// else if (data.id === modalAddEditData.id && modalAddEditMode === "edit") {
			// 	setModalAddEditOpen(true); // if we wait the lock confirmation to show the dialog
			// }
		}
		else if (data.type === "unlock") {
			if (data.status !== "success") {
				alert(`Unlock request failed:\n${data.msg}`);
			}
		}
	},[setAllEntries, appendEntry, updateEntry, deleteEntry]);

	const [isConnected, sendWsText, sendWsJson] = useWebSocket(
		"ws://" + host + ":1234", wsConnecCond,
		onWsOpen, onWsMessage, onWsError, onWsClose
	);

	useEffect(() => {
		if (!isConnected) {return;}
		sendWsJson({userName: validatedLogin});
	}, [isConnected,sendWsJson]);


	return (
		<Root>
			<Section>
				<Button iconClass="fas fa-plus"       bDisabled={!isConnected} onClick={handleAddEntry}/>
				<Button iconClass="fas fa-pencil-alt" bDisabled={!isConnected} onClick={handleUpdateEntry}/>
				<Button iconClass="fas fa-minus"      bDisabled={!isConnected} onClick={handleDeleteEntry}/>
			</Section>
			<Main>
				<Table
					entries={entries}
					deselectAllRows={deselectAllRows}
					selectRow={selectRow}
					selectedId={selectedEntryId}
				/>
			</Main>
			<FormLogin
				isOpen={modalLoginOpen}
				login={login}
				setLogin={setLogin}
				onOk={() => setModalLoginOpen(false)}
			/>
			<FormAddEdit
				isOpen={modalAddEditOpen}
				data={modalAddEditData}
				setData={setModalAddEditData}
				onOk={handleAddEditOk}
				onCancel={handleAddEditCancel}
			/>
		</Root>
	);


	function selectRow(id) {
		setSelectedEntryId(id);
	}

	function deselectAllRows() {
		setSelectedEntryId(-1);
	}

	function handleAddEditCancel() {
		if (modalAddEditMode === "edit") {
			// unlock the entry being edited
			sendWsJson({rqtType: "unlock", rqtData: modalAddEditData.id});
		}

		// close and reset everything
		setModalAddEditOpen(false);
		setModalAddEditMode("");
		setModalAddEditData(defaultModalData);
	}

	function handleAddEditOk() {
		// remark: the input (i.e. modalAddEditData) is checked inside the dialog
		setModalAddEditOpen(false);

		if (modalAddEditMode === "add") {
			let data = {description: modalAddEditData.description, number: modalAddEditData.number};
			sendWsJson({rqtType: "insert", rqtData: data});
		}
		else if (modalAddEditMode === "edit") {
			// update the entry and unlock it
			sendWsJson({rqtType: "update", rqtData: modalAddEditData});
			sendWsJson({rqtType: "unlock", rqtData: modalAddEditData.id});
		}

		setModalAddEditMode("");
		setModalAddEditData(defaultModalData);
	}

	function handleAddEntry() {
		setModalAddEditOpen(true);
		setModalAddEditMode("add");
		setModalAddEditData(defaultModalData);
	}

	function handleUpdateEntry() {
		let selectedEntry = entries.find(e => e.id === selectedEntryId);
		if (!selectedEntry) {return;}

		// lock the entry to update
		sendWsJson({rqtType: "lock", rqtData: selectedEntry.id});
		
		// fill and show the dialog data
		setModalAddEditMode("edit");
		setModalAddEditData({id: selectedEntry.id, description: selectedEntry.description, number: selectedEntry.number});
		setModalAddEditOpen(true);
	}

	function handleDeleteEntry() {
		let selectedEntry = entries.find(e => e.id === selectedEntryId);
		if (!selectedEntry) {return;}

		// lock the entry and send the delete request
		sendWsJson({rqtType: "lock", rqtData: selectedEntryId});
		sendWsJson({rqtType: "delete", rqtData: selectedEntryId});
	}
}

