`timescale 1ns / 1ps

module top(
    input clk,
    input [7:0] sw,
    output [7:0] led,
    output uart_tx,
    input uart_rx,
    output reg uart_cts = 0,
    input uart_rts,
    output reg [2:0]hexplay_an = 0,
    output reg [3:0]hexplay_data = 0
    );
    assign led = ~sw;
    assign uart_tx = uart_rx;
endmodule
