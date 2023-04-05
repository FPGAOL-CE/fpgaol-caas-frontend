`timescale 1ns / 1ps

module top(
    input clk,
    input [7:0] sw,
    output [7:0] led,
    output reg uart_tx0 = 0,
    input uart_rx0,
    output reg [2:0]hexplay0_an = 0,
    output reg [3:0]hexplay0_d = 0
    );
    assign led = ~sw;
endmodule
