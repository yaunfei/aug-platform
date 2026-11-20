package com.aug.record.consumer;

import org.apache.dubbo.config.spring.context.annotation.EnableDubbo;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 下游模拟 Consumer 启动类（默认 8180）。
 */
@SpringBootApplication
@EnableDubbo
public class RecordConsumerDemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(RecordConsumerDemoApplication.class, args);
    }
}
