/* eslint-disable react/no-children-prop */
/* eslint-disable no-console */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useEffect } from 'react';
import {
  Badge,
  InfiniteList,
  PopOverItem,
  Modal,
  ModalHeader,
  ModalBody,
  ModalButtonGroup,
  ModalButton,
  ChatBubble,
  ChatBubbleContainer,
  EditableChatBubble,
  formatDate,
  formatTime,
  useNotificationDispatch,
} from 'amazon-chime-sdk-component-library-react';
import { AttachmentProcessor } from './AttachmentProcessor';

import {
  listChannelMessages,
  createMemberArn,
  updateChannelMessage,
  redactChannelMessage,
} from '../../api/ChimeAPI';
import insertDateHeaders from '../../utilities/insertDateHeaders';

import './Messages.css';
import { useChatChannelState } from '../../providers/ChatMessagesProvider';

const Messages = ({
  messages,
  messagesRef,
  setMessages,
  channelArn,
  channelName,
  userId,
  setChannelMessageToken,
  activeChannelRef,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { channelMessageTokenRef } = useChatChannelState();
  const notificationDispatch = useNotificationDispatch();

  const handleScrollTop = async () => {
    setIsLoading(true);
    if (!channelMessageTokenRef.current) {
      console.log('No new messages');
      setIsLoading(false);
      return;
    }
    const oldMessages = await listChannelMessages(
      activeChannelRef.current.ChannelArn,
      userId,
      activeChannelRef.current.SubChannelId,
      channelMessageTokenRef.current
    );
    const newMessages = [...oldMessages.Messages, ...messagesRef.current];

    setMessages(newMessages);
    setChannelMessageToken(oldMessages.NextToken);
    setIsLoading(false);
  };

  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showRedactModal, setShowRedactModal] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [redactingMessageId, setRedactingMessageId] = useState('');

  const handleDiscardEdit = () => {
    setShowDiscardModal(false);
    setEditingMessageId('');
  };

  const discardModal = (
    <Modal onClose={() => setShowDiscardModal(false)}>
      <ModalHeader title="Discard Changes?" />
      <ModalBody>
        <div>You cannot undo this action.</div>
        <ModalButtonGroup
          primaryButtons={[
            <ModalButton
              label="Discard"
              type="submit"
              variant="primary"
              onClick={handleDiscardEdit}
              key="1"
            />,
            <ModalButton
              label="Cancel"
              variant="secondary"
              closesModal
              key="2"
            />,
          ]}
        />
      </ModalBody>
    </Modal>
  );

  const handleSubChannelIdCopyClick = (_e) => {
    // Create new element
    const el = document.createElement("textarea");
    // Set value (string to be copied)
    el.value = activeChannelRef.current.SubChannelId;
    // Set non-editable to avoid focus and move outside of view
    el.setAttribute("readonly", "");
    el.style = { position: "absolute", left: "-9999px" };
    document.body.appendChild(el);
    // Select text inside element
    el.select();
    // Copy text to clipboard
    document.execCommand("copy");
    // Remove temporary element
    document.body.removeChild(el);

    notificationDispatch({
      type: 0,
      payload: {
        message: "ChannelId copied to clipboard!",
        severity: "info",
        autoClose: true,
        autoCloseDelay: 1000,
      },
    });
  };

  const handleShowRedactModal = (messageId) => {
    setRedactingMessageId(messageId);
    setShowRedactModal(true);
  };

  const handleCloseRedactModal = () => {
    setRedactingMessageId('');
    setShowRedactModal(false);
  };

  const redact = async () => {
    try {
      await redactChannelMessage(channelArn, redactingMessageId, userId, activeChannelRef.current.SubChannelId);
    }
    catch {
      notificationDispatch({
        type: 0,
        payload: {
          message: 'Error, unable to perform this action.',
          severity: 'error',
        },
      });
    }
    setShowRedactModal(false);
  };

  const redactModal = (
    <Modal onClose={handleCloseRedactModal}>
      <ModalHeader title="Delete Message?" />
      <ModalBody>
        <div>You cannot undo this action.</div>
        <ModalButtonGroup
          primaryButtons={[
            <ModalButton
              label="Delete"
              type="submit"
              variant="primary"
              onClick={redact}
              key="1"
            />,
            <ModalButton
              label="Cancel"
              variant="secondary"
              closesModal
              key="2"
            />,
          ]}
        />
      </ModalBody>
    </Modal>
  );

  const cancelEdit = (e) => {
    e.preventDefault();
    setShowDiscardModal(true);
  };

  const saveEdit = async (e, newText, metadata) => {
    e.preventDefault();
    try {
      await updateChannelMessage(
        channelArn,
        editingMessageId,
        newText,
        metadata,
        userId,
        activeChannelRef.current.SubChannelId
      );
    }
    catch {
      notificationDispatch({
        type: 0,
        payload: {
          message: 'Error, unable to perform this action.',
          severity: 'error',
        },
      });
    }
    setEditingMessageId('');
  };

  const flattenedMessages = messages.map((m) => {
    if (m.OldMessageUpdateDisabled) {
      return <Badge
        key={`UpdateSubChannelMembership${activeChannelRef.current.SubChannelId}`}
        value={'*** You have been moved to a new subchannel. ***'}
        className="date-header"
      />
    };
    const content = !m.Content || m.Redacted ? '(Deleted)' : m.Content;
    let editedNote;
    if (m.LastEditedTimestamp && !m.Redacted) {
      const time = formatTime(m.LastEditedTimestamp);
      const date = formatDate(
        m.LastEditedTimestamp,
        undefined,
        undefined,
        'today',
        'yesterday'
      );
      editedNote = (
        <i style={{ fontStyle: 'italic' }}>{` (edited ${date} at ${time})`}</i>
      );
    }

    const messageStatus = m.Status.Value == null ? 'SENT' : m.Status.Value;
    let statusNote;
    if (messageStatus !== 'SENT') {
      statusNote = (
        <i style={{ fontStyle: 'italic' }}>{`     (${messageStatus})`}</i>
      );
    }
    
    return {
      content: content,
      editedNote: editedNote,
      messageId: m.MessageId,
      createdTimestamp: m.CreatedTimestamp,
      redacted: m.Redacted,
      senderName: m.Sender.Name,
      senderId: m.Sender.Arn,
      metadata: m.Metadata,
      status: m.Status.Value,
      statusNote: statusNote,
    };
  });

  const listItems = insertDateHeaders(flattenedMessages);

  const messageList = listItems.map((m, i, self) => {
    if (!m.content) {
      return m;
    }

    if (m.Metadata) {
      let metadata = JSON.parse(m.Metadata);
      if (metadata.isMeetingInfo) {
        return m;
      };
    }

    const variant =
      createMemberArn(userId) === m.senderId ? 'outgoing' : 'incoming';
    let actions = null;
    const messageStatus = m.status == null ? 'SENT' : m.status;
    if (variant === 'outgoing' && messageStatus === 'SENT') {
      actions = [
        <PopOverItem
          key="1"
          children={<span>Edit</span>}
          onClick={() => setEditingMessageId(m.messageId)}
        />,
        <PopOverItem
          key="2"
          children={<span>Delete</span>}
          onClick={() => handleShowRedactModal(m.messageId)}
        />,
      ];
    }

    const prevMessageSender = self[i - 1]?.senderId;
    const currMessageSender = m.senderId;
    const nextMessageSender = self[i + 1]?.senderId;

    let showTail = true;
    if (
      currMessageSender && // it is a message
      nextMessageSender && // the item after is a message
      currMessageSender === nextMessageSender // the item after is from the same sender
    ) {
      showTail = false;
    }
    let showName = true;
    if (
      currMessageSender && // it is a message
      prevMessageSender && // the item before is a message
      currMessageSender === prevMessageSender // the message before is from the same sender
    ) {
      showName = false;
    }

    const attachment = (metadata) => {
      try {
        const metadataJSON = JSON.parse(metadata);
        return metadataJSON?.attachments[0];
      } catch (err) {
        // not an json object! ignoring
      }
      return false;
    };

    return (
      <div className="message">
        <ChatBubbleContainer
          timestamp={formatTime(m.createdTimestamp)}
          actions={actions}
          key={`message${i.toString()}`}
          css="margin: 1rem;"
        >
          {editingMessageId === m.messageId && !m.redacted ? (
            <EditableChatBubble
              variant={variant}
              senderName={m.senderName}
              content={m.content}
              save={(event, value) => saveEdit(event, value, m.metadata)}
              cancel={cancelEdit}
              showName={showName}
              showTail={showTail}
            />
          ) : (
            <ChatBubble
              variant={variant}
              senderName={m.senderName}
              redacted={m.redacted}
              showName={showName}
              showTail={showTail}
            >
              <div>
                {m.content}
                {m.editedNote}
                {m.statusNote}
              </div>
              {m.metadata && attachment(m.metadata) && (
                <div style={{ marginTop: '10px' }}>
                  <AttachmentProcessor
                    senderId={m.senderId}
                    {...attachment(m.metadata)}
                  />
                </div>
              )}
            </ChatBubble>
          )}
        </ChatBubbleContainer>
      </div>
    );
  });

  return (
    <div className="message-list-container">
      {showDiscardModal && discardModal}
      {showRedactModal && redactModal}
      {activeChannelRef.current.SubChannelId ? (
        <div className="message-list-header">
          <a className="user-info" href="#">
            {channelName}
            <span onClick={handleSubChannelIdCopyClick} className="tooltiptext">
              Click to copy channelId to clipboard!
            </span>
          </a>
        </div>
      ) : (
        <div className="message-list-header">{channelName}</div>
      )}
      <InfiniteList
        style={{ display: 'flex', flexGrow: '1' }}
        items={messageList}
        onLoad={handleScrollTop}
        isLoading={isLoading}
        className="chat-message-list"
      />
    </div>
  );
};
export default Messages;
