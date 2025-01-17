import { useState, useEffect, useMemo } from "react";
import { useConnection } from "state/hooks";
import { onboard } from "utils";
import useWindowSize from "hooks/useWindowsSize";
import getTxClient from "state/transferHistory";
import { Transfer } from "@across-protocol/sdk-v2/dist/transfers-history/model";
import { transfersHistory } from "@across-protocol/sdk-v2";
import { getTxHistoryPageSize, setTxHistoryPageSize } from "utils/localStorage";

const MAX_TIME_FOR_FETCHING_TX = 5 * 60 * 1000;
const DEFAULT_TX_HISTORY_PAGE_SIZE = 10;

export interface TxLink {
  text: string;
  url: string;
}

export default function useTransactionsView() {
  const { provider, chainId, isConnected, account } = useConnection();
  const { init } = onboard;
  const { width } = useWindowSize();
  const [openFilledRow, setOpenFilledRow] = useState<number>(-1);
  const [openOngoingRow, setOpenOngoingRow] = useState<number>(-1);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(
    getTxHistoryPageSize() || DEFAULT_TX_HISTORY_PAGE_SIZE
  );
  const [rawFilledTx, setRawFilledTx] = useState<Transfer[]>([]);
  const [rawOngoingTx, setRawOngoingTx] = useState<Transfer[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [txClient] = useState(getTxClient);
  // Start the tracking / stopping of the TX in the client.
  const [timer, setTimer] = useState<NodeJS.Timeout | undefined>();
  const pageSizes = useMemo(() => [10, 25, 50], []);
  const [openModal, setOpenModal] = useState(false);
  const [modalData, setModalData] = useState<TxLink[]>([]);

  useEffect(() => {
    if (txClient) {
      txClient.on(
        transfersHistory.TransfersHistoryEvent.TransfersUpdated,
        (data) => {
          setInitialLoading(false);
          const nextFilledTx = txClient.getFilledTransfers(data.depositorAddr);
          const nextOngoingTx = txClient.getPendingTransfers(
            data.depositorAddr
          );
          setRawFilledTx(nextFilledTx);
          setRawOngoingTx(nextOngoingTx);
        }
      );
    }
  }, [txClient]);

  useEffect(() => {
    if (account && txClient) {
      setInitialLoading(true);
      txClient.startFetchingTransfers(account).catch((err) => {
        console.error(
          "Error in txHistoryClient::startFetchingTransfers call",
          err
        );
      });
      // start timer that stops fetching events after a certain time
      const timeout = setTimeout(() => {
        txClient.stopFetchingTransfers(account);
        setTimer(undefined);
      }, MAX_TIME_FOR_FETCHING_TX);
      setTimer(timeout);
    }

    return () => {
      if (account && txClient) {
        txClient.stopFetchingTransfers(account);
        setRawFilledTx([]);
        setRawOngoingTx([]);
      }
    };
  }, [account, txClient]);

  useEffect(() => {
    return () => {
      // inside the cleanup function make sure that the old timer
      // is cleared after setting up a new timer
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [timer]);

  function onPageSizeChange(value: number) {
    setPageSize(value);
    setTxHistoryPageSize(value);
  }

  return {
    provider,
    chainId,
    isConnected,
    account,
    initOnboard: init,
    // windowSize can return undefined -- default to 0 for easier typing.
    width: width || 0,
    openFilledRow,
    setOpenFilledRow,
    openOngoingRow,
    setOpenOngoingRow,
    currentPage,
    setCurrentPage,
    pageSizes,
    pageSize,
    setPageSize: onPageSizeChange,
    rawFilledTx,
    rawOngoingTx,
    initialLoading,
    modalData,
    setModalData,
    openModal,
    setOpenModal,
  };
}

export const CLOSED_DROPDOWN_INDEX = -1;
